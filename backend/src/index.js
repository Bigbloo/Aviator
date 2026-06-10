/**
 * index.js
 * Main Express server with Socket.IO for real-time multiplier broadcasting.
 *
 * Game loop:
 *  WAITING (5s) → FLYING (multiplier grows every 50ms with tension curve) → CRASHED → WAITING …
 *
 * Socket events emitted by server:
 *  round:start       { roundId, startTime, serverSeed }
 *  multiplier:update { roundId, multiplier, tensionLevel }   ← tensionLevel 0-1 for visual stress
 *  round:crash       { roundId, crashPoint }
 *  game:state        { phase, roundId, currentMultiplier, startTime }  ← on connect
 *
 * Socket events received from client:
 *  cashout           { userId, roundId, betAmount, multiplierAtCashout }
 *                    → ack: { result, payout, balance } | { error }
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const userRoutes = require('./routes/userRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const gameRoutes = require('./routes/gameRoutes');
const {
  generateCrashPoint,
  getTensionFactor,
  resolveCashout,
} = require('./controllers/gameController');
const db = require('./db/database');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));

// ── Stripe webhook needs raw body ─────────────────────────────────────────────
app.use('/api/webhook', express.raw({ type: 'application/json' }));

// ── JSON body parser ──────────────────────────────────────────────────────────
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', userRoutes);
app.use('/api', paymentRoutes);
app.use('/api', gameRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// ── Game state ────────────────────────────────────────────────────────────────
let gameState = {
  phase: 'waiting',       // 'waiting' | 'flying' | 'crashed'
  roundId: null,
  crashPoint: null,
  currentMultiplier: 1.0,
  startTime: null,
  serverSeed: null,       // graine serveur du round (pour seed individualisé)
};

const WAITING_DURATION = 5000;  // ms entre les rounds
const TICK_INTERVAL    = 50;    // ms — émet multiplier:update toutes les 50ms
const BASE_STEP        = 0.01;  // incrément de base par tick

// ── Calcul du niveau de tension (0 à 1) ──────────────────────────────────────
/**
 * Retourne un niveau de tension entre 0 et 1 basé sur la proximité du crash.
 * Utilisé pour l'interface de stress visuel côté client.
 */
const computeTensionLevel = (currentMultiplier, crashPoint) => {
  if (!crashPoint || currentMultiplier < 1.2) return 0;
  // Tension = progression vers le crash (0 = début, 1 = crash imminent)
  const progress = Math.min((currentMultiplier - 1) / (crashPoint - 1), 1);
  // Courbe exponentielle pour accentuer la tension en fin de round
  return Math.pow(progress, 1.5);
};

// ── Game loop ─────────────────────────────────────────────────────────────────
const startNewRound = () => {
  // Nettoyer les rounds actifs résiduels
  db.prepare(
    "UPDATE rounds SET status = 'crashed', ended_at = strftime('%s', 'now') WHERE status = 'active'"
  ).run();

  const roundId    = uuidv4();
  const crashPoint = generateCrashPoint();
  const startTime  = Date.now();
  const serverSeed = crypto.randomBytes(16).toString('hex'); // graine serveur unique

  db.prepare('INSERT INTO rounds (id, crash_point, status) VALUES (?, ?, ?)').run(
    roundId, crashPoint, 'active'
  );

  gameState = {
    phase: 'flying',
    roundId,
    crashPoint,
    currentMultiplier: 1.0,
    startTime,
    serverSeed,
  };

  console.log(`[Round ${roundId}] Flying — crash at x${crashPoint} | seed: ${serverSeed.slice(0, 8)}...`);

  // Broadcast round start — inclut serverSeed pour le seed individualisé côté client
  io.emit('round:start', { roundId, startTime, serverSeed });

  // Tick toutes les 50ms
  const tick = setInterval(() => {
    const tensionFactor = getTensionFactor(gameState.currentMultiplier);
    const step = Math.round(BASE_STEP * tensionFactor * 100) / 100;
    gameState.currentMultiplier = Math.round((gameState.currentMultiplier + step) * 100) / 100;

    if (gameState.currentMultiplier >= gameState.crashPoint) {
      // ── CRASH ──────────────────────────────────────────────────────────────
      clearInterval(tick);

      const finalCrash = gameState.crashPoint;
      gameState.phase = 'crashed';
      gameState.currentMultiplier = finalCrash;

      db.prepare(
        "UPDATE rounds SET status = 'crashed', ended_at = strftime('%s', 'now') WHERE id = ?"
      ).run(roundId);

      // Marquer toutes les mises en attente comme perdues
      db.prepare(
        "UPDATE bets SET status = 'lost', payout = 0 WHERE round_id = ? AND status = 'pending'"
      ).run(roundId);

      console.log(`[Round ${roundId}] CRASHED at x${finalCrash}`);
      io.emit('round:crash', { roundId, crashPoint: finalCrash });

      gameState = {
        phase: 'waiting',
        roundId: null,
        crashPoint: null,
        currentMultiplier: 1.0,
        startTime: null,
        serverSeed: null,
      };

      setTimeout(startNewRound, WAITING_DURATION);
    } else {
      // Calculer le niveau de tension pour l'interface de stress visuel
      const tensionLevel = computeTensionLevel(gameState.currentMultiplier, gameState.crashPoint);

      // Broadcast à tous les clients
      io.emit('multiplier:update', {
        roundId,
        multiplier: gameState.currentMultiplier,
        tensionLevel, // 0-1 : utilisé pour le fond chaud + haptique
      });
    }
  }, TICK_INTERVAL);
};

// ── Socket.IO connection handler ──────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Envoyer l'état actuel immédiatement pour sync au connect/reconnect
  socket.emit('game:state', {
    phase: gameState.phase,
    roundId: gameState.roundId,
    currentMultiplier: gameState.currentMultiplier,
    startTime: gameState.startTime,
    serverSeed: gameState.serverSeed,
  });

  // Le client rejoint la room du round actuel
  socket.on('join:round', (roundId) => {
    socket.join(roundId);
    console.log(`[Socket] ${socket.id} joined room ${roundId}`);
  });

  /**
   * cashout event — via Socket.IO pour latence minimale.
   * Payload: { userId, roundId, betAmount, multiplierAtCashout }
   * Ack:     { result, payout, balance } | { error }
   */
  socket.on('cashout', async (data, ack) => {
    const { userId, roundId, betAmount, multiplierAtCashout } = data || {};

    if (!userId || !roundId || !betAmount || !multiplierAtCashout) {
      if (typeof ack === 'function') ack({ error: 'Missing required fields' });
      return;
    }

    try {
      const result = resolveCashout({ userId, roundId, betAmount, multiplierAtCashout });
      if (typeof ack === 'function') ack(result);
    } catch (err) {
      console.error('[Cashout Socket Error]', err.message);
      if (typeof ack === 'function') ack({ error: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[Server] Aviator backend running on port ${PORT}`);
  setTimeout(startNewRound, WAITING_DURATION);
});
