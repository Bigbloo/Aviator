const db = require('../db');
const { generateCrashPoint, calculateMultiplier } = require('../utils/crash');

let currentRound = null;

function startRound() {
  if (currentRound && currentRound.status === 'running') {
    return currentRound;
  }

  const crashPoint = generateCrashPoint();
  const startedAt = Date.now();

  const insert = db.prepare('INSERT INTO rounds (crash_point, started_at, status) VALUES (?, ?, ?)');
  const result = insert.run(crashPoint, startedAt, 'running');

  currentRound = {
    id: result.lastInsertRowid,
    crashPoint,
    startedAt,
    status: 'running',
    endedAt: null
  };

  return currentRound;
}

function getCurrentRound() {
  return currentRound;
}

function getRoundById(roundId) {
  const row = db.prepare('SELECT * FROM rounds WHERE id = ?').get(roundId);
  return row || null;
}

function getCurrentMultiplier(round) {
  if (!round) return 1;

  const elapsed = Date.now() - round.startedAt;
  const multiplier = calculateMultiplier(elapsed);

  if (multiplier >= round.crashPoint) {
    endRound(round.id);
    return round.crashPoint;
  }

  return multiplier;
}

function endRound(roundId) {
  const endedAt = Date.now();
  db.prepare('UPDATE rounds SET status = ?, ended_at = ? WHERE id = ?').run('crashed', endedAt, roundId);

  if (currentRound && currentRound.id === roundId) {
    currentRound.status = 'crashed';
    currentRound.endedAt = endedAt;
  }
}

module.exports = {
  startRound,
  getCurrentRound,
  getRoundById,
  getCurrentMultiplier,
  endRound
};
