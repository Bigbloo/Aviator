const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { port, frontendUrl } = require('./config/env');
const paymentRoutes = require('./routes/paymentRoutes');
const gameRoutes = require('./routes/gameRoutes');
const { startRoundLoop, getCurrentRound } = require('./services/roundService');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: frontendUrl,
    methods: ['GET', 'POST']
  }
});

app.use(cors({ origin: frontendUrl }));
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use('/api', paymentRoutes);
app.use('/api', gameRoutes);

io.on('connection', (socket) => {
  socket.on('round:join', ({ roundId }) => {
    socket.join(String(roundId));

    if (!getCurrentRound()) {
      startRoundLoop(io, String(roundId));
    }
  });

  socket.on('cashout', (payload, ack) => {
    try {
      const { userId, roundId, betAmount, multiplierAtCashout } = payload || {};
      const round = getCurrentRound();

      if (!round) {
        return ack({ success: false, error: 'No active round' });
      }

      if (!userId || !roundId || !betAmount || !multiplierAtCashout) {
        return ack({ success: false, error: 'Missing required fields' });
      }

      if (Number(roundId) !== round.id) {
        return ack({ success: false, error: 'Round mismatch' });
      }

      if (multiplierAtCashout >= round.crashPoint) {
        return ack({ success: false, error: 'Round already crashed' });
      }

      const gain = Number((Number(betAmount) * Number(multiplierAtCashout)).toFixed(2));
      db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?').run(gain, userId);
      db.prepare('UPDATE bets SET cashout_multiplier = ?, won = ?, payout = ? WHERE user_id = ? AND round_id = ? ORDER BY id DESC LIMIT 1')
        .run(multiplierAtCashout, 1, gain, userId, round.id);

      const updated = db.prepare('SELECT balance FROM users WHERE user_id = ?').get(userId);
      return ack({ success: true, gain, balance: Number(updated.balance.toFixed(2)) });
    } catch (error) {
      return ack({ success: false, error: 'Cashout failed' });
    }
  });

  socket.emit('connected', { ok: true });
});

server.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
