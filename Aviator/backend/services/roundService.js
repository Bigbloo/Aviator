const db = require('../db');
const { generateCrashPoint } = require('../utils/crash');

const ROUND_TICK_INTERVAL_MS = 50;
const MULTIPLIER_STEP = 0.01;

let currentRound = null;
let roundInterval = null;

function createRound() {
  const crashPoint = generateCrashPoint();
  const startTime = Date.now();

  const result = db
    .prepare('INSERT INTO rounds (crashPoint, startTime, status) VALUES (?, ?, ?)')
    .run(crashPoint, startTime, 'running');

  currentRound = {
    id: Number(result.lastInsertRowid),
    crashPoint,
    startTime,
    endTime: null,
    status: 'running',
    multiplier: 1.0
  };

  return currentRound;
}

function endCurrentRound() {
  if (!currentRound || currentRound.status !== 'running') {
    return currentRound;
  }

  currentRound.status = 'crashed';
  currentRound.endTime = Date.now();

  db.prepare('UPDATE rounds SET status = ?, endTime = ? WHERE id = ?').run(
    'crashed',
    currentRound.endTime,
    currentRound.id
  );

  if (roundInterval) {
    clearInterval(roundInterval);
    roundInterval = null;
  }

  return currentRound;
}

function startRoundLoop(io, roomId) {
  const round = createRound();

  io.to(roomId).emit('round:start', {
    roundId: round.id,
    crashPoint: round.crashPoint,
    startTime: round.startTime
  });

  roundInterval = setInterval(() => {
    if (!currentRound || currentRound.status !== 'running') return;

    const nextMultiplier = Number((currentRound.multiplier + MULTIPLIER_STEP).toFixed(2));
    currentRound.multiplier = Math.min(nextMultiplier, currentRound.crashPoint);

    io.to(roomId).emit('multiplier:update', {
      roundId: currentRound.id,
      multiplier: currentRound.multiplier
    });

    if (currentRound.multiplier >= currentRound.crashPoint) {
      const crashedRound = endCurrentRound();
      io.to(roomId).emit('round:crash', {
        roundId: crashedRound.id,
        crashPoint: crashedRound.crashPoint,
        endTime: crashedRound.endTime
      });
    }
  }, ROUND_TICK_INTERVAL_MS);

  return round;
}

function getCurrentRound() {
  return currentRound;
}

function getCurrentRoundState() {
  if (!currentRound) return null;
  return {
    roundId: currentRound.id,
    status: currentRound.status,
    multiplier: currentRound.multiplier,
    crashPoint: currentRound.crashPoint,
    startTime: currentRound.startTime,
    endTime: currentRound.endTime
  };
}

module.exports = {
  startRoundLoop,
  endCurrentRound,
  getCurrentRound,
  getCurrentRoundState
};
