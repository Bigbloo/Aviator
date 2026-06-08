/**
 * index.js
 * Main Express server with Socket.IO for real-time multiplier broadcasting.
 * Handles CORS for Next.js frontend and Android WebView.
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const userRoutes = require('./routes/userRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const gameRoutes = require('./routes/gameRoutes');
const { generateCrashPoint, setLiveState } = require('./controllers/gameController');
const db = require('./db/database');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// ── Allowed origins ───────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://frontend-wine-six-11.vercel.app',
  'http://localhost:3000',
];
const corsOptions = {
  origin: (origin, cb) => {
    // Allow no-origin (curl, mobile) and any *.vercel.app preview deploy
    if (!origin || ALLOWED_ORIGINS.includes(origin) || /\.vercel\.app$/.test(origin)) {
      return cb(null, true);
    }
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
};

// ── Socket.IO setup ───────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
});

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));

// ── Stripe webhook needs raw body ─────────────────────────────────────────────
app.use('/api/webhook', express.raw({ type: 'application/json' }));

// ── JSON body parser ──────────────────────────────────────────────────────────
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', userRoutes);
app.use('/api', paymentRoutes);
app.use('/api', gameRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// ── Game Loop (Socket.IO) ─────────────────────────────────────────────────────
/**
 * Game state machine:
 * WAITING (3s) → FLYING (multiplier grows) → CRASHED (reveal) → WAITING ...
 */

let gameState = {
  phase: 'waiting',   // 'waiting' | 'flying' | 'crashed'
  roundId: null,
  crashPoint: null,
  currentMultiplier: 1.0,
  startTime: null,
};

const WAITING_DURATION = 4000;   // 4s pause after crash (reveal result)
const BETTING_DURATION = 6000;   // 6s betting window before takeoff
const TICK_INTERVAL = 100;       // broadcast every 100ms
const MULTIPLIER_SPEED = 0.00006; // exponential growth factor

/**
 * Calculates multiplier based on elapsed time.
 * Uses exponential curve: M(t) = e^(k*t)
 */
const calcMultiplier = (elapsedMs) => {
  return Math.round(Math.exp(MULTIPLIER_SPEED * elapsedMs) * 100) / 100;
};

// ── Synthetic players (DEMO) ──────────────────────────────────────────────────
// Generates a handful of fake bet results each round so the live feed looks
// active. Purely cosmetic — these never touch real balances.
const BOT_NAMES = [
  'Lucas', 'Emma', 'Hugo', 'Léa', 'Nathan', 'Chloé', 'Gabriel', 'Manon',
  'Louis', 'Inès', 'Jules', 'Sarah', 'Adam', 'Camille', 'Raphaël', 'Zoé',
  'Tom', 'Lina', 'Noah', 'Jade', 'Enzo', 'Alice', 'Liam', 'Rose',
];

const makeBotResults = (crashPoint) => {
  const n = 4 + Math.floor(Math.random() * 5); // 4..8 bots per round
  const out = [];
  for (let i = 0; i < n; i++) {
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const amount = [1, 2, 5, 10, 20, 50, 100][Math.floor(Math.random() * 7)];
    // Bot picks a random target cashout; wins if it's below the crash point
    const target = Math.round((1.1 + Math.random() * 4) * 100) / 100;
    if (target < crashPoint) {
      const payout = Math.round(amount * target * 100) / 100;
      out.push({ name, amount, multiplier: target, payout, result: 'won' });
    } else {
      out.push({ name, amount, multiplier: null, payout: 0, result: 'lost' });
    }
  }
  return out;
};

/**
 * Starts a new round: generates crash point, stores in DB, begins broadcasting.
 */
const startNewRound = () => {
  // Cleanup previous active rounds
  db.prepare(
    "UPDATE rounds SET status = 'crashed', ended_at = strftime('%s', 'now') WHERE status = 'active'"
  ).run();

  const roundId = uuidv4();
  const crashPoint = generateCrashPoint();

  db.prepare('INSERT INTO rounds (id, crash_point, status) VALUES (?, ?, ?)').run(
    roundId, crashPoint, 'active'
  );

  // ── PHASE 1: BETTING (players place bets, plane on the ground) ──
  gameState = {
    phase: 'betting',
    roundId,
    crashPoint,
    currentMultiplier: 1.0,
    startTime: null,
  };
  setLiveState(gameState);

  console.log(`[Round ${roundId}] Betting window (${BETTING_DURATION}ms) — crash at x${crashPoint}`);
  io.emit('round:betting', { roundId, bettingMs: BETTING_DURATION });

  // ── PHASE 2: FLYING (after betting window closes) ──
  setTimeout(() => {
    gameState.phase = 'flying';
    gameState.startTime = Date.now();
    setLiveState(gameState);

    console.log(`[Round ${roundId}] Flying`);
    io.emit('round:start', { roundId, startedAt: gameState.startTime });

    // Tick loop
    const tick = setInterval(() => {
      const elapsed = Date.now() - gameState.startTime;
      const multiplier = calcMultiplier(elapsed);

      gameState.currentMultiplier = multiplier;

      if (multiplier >= gameState.crashPoint) {
        // CRASH
        clearInterval(tick);
        gameState.phase = 'crashed';
        gameState.currentMultiplier = gameState.crashPoint;
        setLiveState(gameState);

        db.prepare(
          "UPDATE rounds SET status = 'crashed', ended_at = strftime('%s', 'now') WHERE id = ?"
        ).run(roundId);

        // Collect this round's real results (winners cashed out, losers still pending)
        const roundBets = db.prepare(
          `SELECT b.bet_amount, b.cashout_multiplier, b.payout, b.status,
                  COALESCE(u.username, 'Joueur ' || substr(u.id,1,4)) AS name
           FROM bets b JOIN users u ON u.id = b.user_id
           WHERE b.round_id = ?`
        ).all(roundId);

        // Mark all pending bets for this round as lost
        db.prepare(
          "UPDATE bets SET status = 'lost', payout = 0 WHERE round_id = ? AND status = 'pending'"
        ).run(roundId);

        console.log(`[Round ${roundId}] CRASHED at x${gameState.crashPoint}`);

        // Build the results feed (real bets + synthetic bots so the table is lively)
        const realResults = roundBets.map((b) => ({
          name: b.name,
          amount: b.bet_amount,
          multiplier: b.status === 'won' ? b.cashout_multiplier : null,
          payout: b.status === 'won' ? b.payout : 0,
          result: b.status === 'won' ? 'won' : 'lost',
        }));
        const results = realResults.concat(
          makeBotResults(gameState.crashPoint)
        );

        io.emit('round:crash', { roundId, crashPoint: gameState.crashPoint });
        io.emit('bets:results', { roundId, crashPoint: gameState.crashPoint, results });

        // Wait then start new round
        setTimeout(startNewRound, WAITING_DURATION);
      } else {
        io.emit('round:tick', { roundId, multiplier });
      }
    }, TICK_INTERVAL);
  }, BETTING_DURATION);
};

// ── Socket.IO connection handler ──────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Send current game state to newly connected client
  socket.emit('game:state', {
    phase: gameState.phase,
    roundId: gameState.roundId,
    currentMultiplier: gameState.currentMultiplier,
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[Server] Aviator backend running on port ${PORT}`);
  // Start the game loop after a short delay
  setTimeout(startNewRound, WAITING_DURATION);
});
