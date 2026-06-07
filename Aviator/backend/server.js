const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { port, frontendUrl } = require('./config/env');
const paymentRoutes = require('./routes/paymentRoutes');
const gameRoutes = require('./routes/gameRoutes');
const { startRound, getCurrentRound, getCurrentMultiplier, endRound } = require('./services/roundService');

require('./db');

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
  socket.emit('connected', { ok: true });
});

setInterval(() => {
  let round = getCurrentRound();
  if (!round || round.status !== 'running') {
    round = startRound();
    io.emit('round_started', { roundId: round.id });
  }

  const multiplier = getCurrentMultiplier(round);
  const crashed = multiplier >= round.crashPoint;

  io.emit('round_tick', {
    roundId: round.id,
    multiplier,
    crashed,
    crashPoint: crashed ? round.crashPoint : null
  });

  if (crashed) {
    endRound(round.id);
    io.emit('round_crashed', { roundId: round.id, crashPoint: round.crashPoint });
  }
}, 150);

server.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
