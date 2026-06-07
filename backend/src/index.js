/**
 * index.js
 * Main Express server with Socket.IO for real-time multiplier broadcasting.
 *
 * Game loop:
 *  WAITING (5s) → FLYING (multiplier grows every 50ms) → CRASHED → WAITING …
 *
 * Socket events emitted by server:
 *  round:start      { roundId, startTime }
 *  multiplier:update { roundId, multiplier }
 *  round:crash      { roundId, crashPoint }
 *  game:state       { phase, roundId, currentMultiplier, startTime }  ← on connect
 *
 * Socket events received from client:
 *  cashout          { userId, roundId, betAmount, multiplierAtCashout }
 *                   → ack: { result, payout, balance } | { error }
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const userRoutes = require('./routes/userRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const gameRoutes = require('./routes/gameRoutes');
const { generateCrashPoint, resolveCashout } = require('./controllers/gameController');
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
};

const WAITING_DURATION = 5000;  // ms between rounds
const TICK_INTERVAL    = 50;    // ms — emit multiplier:update every 50ms
const MULTIPLIER_STEP  = 0.01;  // increment per tick

// ── Game loop ─────────────────────────────────────────────────────────────────
const startNewRound = () => {
  // Clean up any stale active rounds
  db.prepare(
    "UPDATE rounds SET status = 'crashed', ended_at = strftime('%s', 'now') WHERE status = 'active'"
  ).run();

  const roundId  = uuidv4();
  const crashPoint = generateCrashPoint();
  const startTime  = Date.now();

  db.prepare('INSERT INTO rounds (id, crash_point, status) VALUES (?, ?, ?)').run(
    roundId, crashPoint, 'active'
  );

  gameState = {
    phase: 'flying',
    roundId,
    crashPoint,
    currentMultiplier: 1.0,
    startTime,
  };

  console.log(`[Round ${roundId}] Flying — crash at x${crashPoint}`);

  // Broadcast round start to all clients; clients join the round room
  io.emit('round:start', { roundId, startTime });

  // Tick every 50ms
  const tick = setInterval(() => {
    gameState.currentMultiplier = Math.round((gameState.currentMultiplier + MULTIPLIER_STEP) * 100) / 100;

    if (gameState.currentMultiplier >= gameState.crashPoint) {
      // ── CRASH ──────────────────────────────────────────────────────────────
      clearInterval(tick);

      const finalCrash = gameState.crashPoint;
      gameState.phase = 'crashed';
      gameState.currentMultiplier = finalCrash;

      db.prepare(
        "UPDATE rounds SET status = 'crashed', ended_at = strftime('%s', 'now') WHERE id = ?"
      ).run(roundId);

      // Mark all pending bets as lost
      db.prepare(
        "UPDATE bets SET status = 'lost', payout = 0 WHERE round_id = ? AND status = 'pending'"
      ).run(roundId);

      console.log(`[Round ${roundId}] CRASHED at x${finalCrash}`);
      io.emit('round:crash', { roundId, crashPoint: finalCrash });

      // Reset state then wait
      gameState = {
        phase: 'waiting',
        roundId: null,
        crashPoint: null,
        currentMultiplier: 1.0,
        startTime: null,
      };

      setTimeout(startNewRound, WAITING_DURATION);
    } else {
      // Broadcast current multiplier to all clients in this round's room
      io.to(roundId).emit('multiplier:update', {
        roundId,
        multiplier: gameState.currentMultiplier,
      });
      // Also broadcast to clients not yet in the room (just connected)
      io.emit('multiplier:update', {
        roundId,
        multiplier: gameState.currentMultiplier,
      });
    }
  }, TICK_INTERVAL);
};

// ── Socket.IO connection handler ──────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Send current game state immediately so client can sync on connect/reconnect
  socket.emit('game:state', {
    phase: gameState.phase,
    roundId: gameState.roundId,
    currentMultiplier: gameState.currentMultiplier,
    startTime: gameState.startTime,
  });

  // Client joins the room for the current round (for targeted broadcasts)
  socket.on('join:round', (roundId) => {
    socket.join(roundId);
    console.log(`[Socket] ${socket.id} joined room ${roundId}`);
  });

  /**
   * cashout event — client sends this instead of REST call for lower latency.
   * Payload: { userId, roundId, betAmount, multiplierAtCashout }
   * Ack:     { result, payout, balance } | { error }
   */
  socket.on('cashout', async (data, ack) => {
    const { userId, roundId, betAmount, multiplierAtCashout } = data || {};

    if (!userId || !roundId || !betAmount || !multiplierAtCashout) {
      if (typeof ack === 'function') ack({ error: 'Missing required fields' });
      return;
    }

    // Verify the multiplier is still valid (< crashPoint, round still active or just crashed)
    const currentCrash = gameState.roundId === roundId
      ? gameState.crashPoint
      : null;

    // If round already crashed and multiplierAtCashout >= crashPoint → lost
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
