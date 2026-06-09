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
const rateLimit = require('express-rate-limit');

const userRoutes = require('./routes/userRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const gameRoutes = require('./routes/gameRoutes');
const cryptoRoutes = require('./routes/cryptoRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { isMock } = require('./config');
const { generateCrashPoint, setLiveState } = require('./controllers/gameController');
const db = require('./db/database');
const topWins = require('./topWins');
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

// ── Rate limiting (#9 — anti-spam / anti-abuse) ──────────────────────────────
// Behind Railway's proxy, trust it so the limiter sees the real client IP.
app.set('trust proxy', 1);

// Tight limiter for game actions (bet/cashout) — fast-paced but capped.
const actionLimiter = rateLimit({
  windowMs: 10 * 1000, // 10s window
  max: 30,             // max 30 actions / 10s / IP (3/s sustained)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, ralentissez un instant.' },
});

// Stricter limiter for auth & money endpoints (register/login/deposit/withdraw).
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min window
  max: 15,             // max 15 / min / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans une minute.' },
});

app.use(['/api/bet', '/api/cashout'], actionLimiter);
app.use(
  ['/api/register', '/api/login', '/api/deposit/simulate', '/api/withdraw', '/api/crypto/deposit', '/api/crypto/withdraw', '/api/admin', '/api/forgot-password', '/api/reset-password', '/api/resend-verification'],
  authLimiter
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', userRoutes);
app.use('/api', paymentRoutes);
app.use('/api', gameRoutes);
app.use('/api', cryptoRoutes);
app.use('/api/admin', adminRoutes); // requireAdmin confined to /api/admin/*

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// Public client config.
app.get('/api/config', (req, res) => res.json({ simulated: isMock() }));

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

// Spribe-style masked handles (e.g. "5***7", "d***2") so the feed looks busy
// with hundreds of distinct-looking players (all masked, like the real game).
const MASK_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const maskedName = () => `${pick(MASK_CHARS)}***${Math.floor(Math.random() * 9) + 1}`;
const botName = () => maskedName();

// Realistic bet distribution — most players stake small, few stake big.
const realisticBet = () => {
  const r = Math.random();
  if (r < 0.5) return pick([1, 2, 3, 5]);
  if (r < 0.8) return pick([10, 15, 20, 25]);
  if (r < 0.95) return pick([50, 75, 100]);
  return pick([150, 200, 300, 500]);
};

// Inflated "total bets this round" count shown in the All Bets header (cosmetic,
// like real Aviator showing thousands while only a slice is rendered).
const roundTotalBets = () => 2500 + Math.floor(Math.random() * 4500); // 2500..7000

const makeBotBets = () => {
  const n = 80 + Math.floor(Math.random() * 90); // 80..170 bots per round (busy feed)
  const out = [];
  for (let i = 0; i < n; i++) {
    const name = botName();

    const amount = realisticBet();

    // To keep clearly MORE winners than losers: ~82% of bots aim VERY low
    // (1.02–1.22) so they almost always clear before the crash, ~18% greedy.
    let target;
    if (Math.random() < 0.82) {
      target = Math.round((1.02 + Math.random() * 0.2) * 100) / 100; // 1.02..1.22 (wins most rounds)
    } else {
      target = Math.round((1.6 + Math.random() * 4) * 100) / 100;    // 1.6..5.6 (riskier)
    }
    out.push({ name, amount, target, cashedOut: false });
  }
  return out;
};

// ── Crash history (last 20 multipliers) ───────────────────────────────────────
// ── Recover orphaned bets from an interrupted round (server restart) ──────────
// A restart mid-round leaves bets stuck 'pending' (debited but never resolved).
// Refund them so no player silently loses a stake to a redeploy/crash.
try {
  const orphans = db.prepare("SELECT id, user_id, bet_amount FROM bets WHERE status = 'pending'").all();
  if (orphans.length) {
    const refund = db.transaction(() => {
      for (const b of orphans) {
        db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(b.bet_amount, b.user_id);
        db.prepare("INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)")
          .run(uuidv4(), b.user_id, 'bet_refund', b.bet_amount);
        db.prepare("UPDATE bets SET status = 'refunded' WHERE id = ?").run(b.id);
      }
      db.prepare("UPDATE rounds SET status = 'crashed', ended_at = strftime('%s','now') WHERE status = 'active'").run();
    });
    refund();
    console.log(`[Recovery] Refunded ${orphans.length} orphaned pending bet(s) from a previous run`);
  }
} catch (e) {
  console.error('[Recovery] orphaned-bet refund failed:', e.message);
}

let crashHistory = [];
// On boot, load the last 20 crashed rounds from DB so history survives restarts
try {
  const past = db
    .prepare("SELECT crash_point FROM rounds WHERE status = 'crashed' ORDER BY started_at DESC LIMIT 20")
    .all();
  crashHistory = past.map((r) => r.crash_point).reverse();
} catch (e) {
  crashHistory = [];
}
const pushHistory = (crashPoint) => {
  crashHistory.push(crashPoint);
  if (crashHistory.length > 20) crashHistory.shift();
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

  // Pre-generate this round's bots with a target cashout each (live feed)
  const bots = makeBotBets(); // [{name, amount, target, cashedOut:false}]
  const totalBets = roundTotalBets(); // inflated header count for "All Bets"

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

  // Announce active bots so the live table fills up DURING betting/flight
  io.emit('bets:active', {
    roundId,
    total: totalBets,
    bets: bots.map((b) => ({ name: b.name, amount: b.amount })),
  });

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

      // Bots cash out live when the multiplier reaches their target (and target < crash)
      for (const b of bots) {
        if (!b.cashedOut && b.target <= multiplier && b.target < crashPoint) {
          b.cashedOut = true;
          const payout = Math.round(b.amount * b.target * 100) / 100;
          io.emit('bet:cashout', { roundId, name: b.name, multiplier: b.target, payout });
        }
      }

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

        // Build the results feed: real bets + bots (bots that didn't cash out = lost)
        const realResults = roundBets.map((b) => ({
          name: b.name,
          amount: b.bet_amount,
          multiplier: b.status === 'won' ? b.cashout_multiplier : null,
          payout: b.status === 'won' ? b.payout : 0,
          result: b.status === 'won' ? 'won' : 'lost',
        }));
        const botResults = bots.map((b) =>
          b.cashedOut
            ? { name: b.name, amount: b.amount, multiplier: b.target, payout: Math.round(b.amount * b.target * 100) / 100, result: 'won' }
            : { name: b.name, amount: b.amount, multiplier: null, payout: 0, result: 'lost' }
        );
        const results = realResults.concat(botResults);

        // Feed the Top Winners board with this round's notable wins.
        for (const r of results) {
          if (r.result === 'won' && r.multiplier && r.multiplier >= 5) {
            topWins.record({ name: r.name, bet: r.amount, multiplier: r.multiplier });
          }
        }

        pushHistory(gameState.crashPoint);
        io.emit('round:crash', { roundId, crashPoint: gameState.crashPoint });
        io.emit('bets:results', { roundId, crashPoint: gameState.crashPoint, results });
        io.emit('history:update', { history: crashHistory });

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

  // Send the crash history so the bar is populated immediately
  socket.emit('history:update', { history: crashHistory });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[Server] Aviator backend running on port ${PORT}`);
  console.log(`[Crypto] USDT payments mode: ${isMock() ? 'MOCK (no API key)' : 'LIVE (NOWPayments) — demo is admin-only per request'}`);
  // Automatic DB backups
  try { require('./backup').start(); } catch (e) { console.error('[Backup] init failed:', e.message); }
  // Start the game loop after a short delay
  setTimeout(startNewRound, WAITING_DURATION);
});
