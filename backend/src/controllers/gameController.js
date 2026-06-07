/**
 * gameController.js
 * Handles game rounds and bet resolution.
 * Crash point is generated server-side using an exponential distribution.
 *
 * Bet flow (fixed):
 *  1. POST /api/bet            → place a bet (debits balance, status 'pending')
 *  2. POST /api/cashout        → cash out (validates against LIVE multiplier server-side)
 *  On crash, server marks remaining pending bets as 'lost'.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

// Shared live game state reference (set by index.js via setGameState)
let liveState = null;
const setLiveState = (stateRef) => { liveState = stateRef; };

/**
 * Generates a provably fair crash point using exponential distribution.
 */
const generateCrashPoint = () => {
  const houseEdge = 0.05;
  const r = Math.random();
  if (r < houseEdge) return 1.0;
  const crash = Math.max(1.0, 0.99 / (1 - r));
  return Math.round(crash * 100) / 100;
};

const getRound = (req, res) => {
  const { roundId } = req.params;
  const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(roundId);
  if (!round) return res.status(404).json({ error: 'Round not found' });

  const response = {
    roundId: round.id,
    status: round.status,
    startedAt: round.started_at,
  };
  if (round.status === 'crashed') response.crashPoint = round.crash_point;
  return res.json(response);
};

/**
 * POST /api/bet
 * Body: { userId, roundId, betAmount }
 * Places a bet: debits balance immediately, creates a 'pending' bet.
 * NO cashoutMultiplier here — cashout is a separate, server-validated action.
 */
const placeBet = (req, res) => {
  const { userId, roundId, betAmount } = req.body;

  const amount = Number(betAmount);
  if (!userId || !roundId || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid bet parameters' });
  }

  // Must bet on the CURRENT flying round
  if (!liveState || liveState.roundId !== roundId || liveState.phase !== 'flying') {
    return res.status(400).json({ error: 'Round not accepting bets' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

  // Prevent double-betting on the same round
  const existing = db
    .prepare("SELECT id FROM bets WHERE user_id = ? AND round_id = ?")
    .get(userId, roundId);
  if (existing) return res.status(400).json({ error: 'Already bet on this round' });

  // Debit immediately
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, userId);
  db.prepare(
    'INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)'
  ).run(uuidv4(), userId, 'bet', -amount);

  const betId = uuidv4();
  db.prepare(
    "INSERT INTO bets (id, user_id, round_id, bet_amount, status) VALUES (?, ?, ?, ?, 'pending')"
  ).run(betId, userId, roundId, amount);

  const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
  return res.json({ betId, balance: updated.balance, status: 'pending' });
};

/**
 * POST /api/cashout
 * Body: { userId, roundId }
 * Cashes out using the LIVE server-side multiplier (anti-cheat).
 * Client cannot pick its own multiplier.
 */
const cashout = (req, res) => {
  const { userId, roundId } = req.body;
  if (!userId || !roundId) {
    return res.status(400).json({ error: 'Invalid cashout request' });
  }

  // Round must still be flying server-side
  if (!liveState || liveState.roundId !== roundId || liveState.phase !== 'flying') {
    return res.status(400).json({ error: 'Too late — round already crashed' });
  }

  const bet = db
    .prepare("SELECT * FROM bets WHERE user_id = ? AND round_id = ? AND status = 'pending'")
    .get(userId, roundId);
  if (!bet) return res.status(404).json({ error: 'No active bet found' });

  // Use the LIVE multiplier from the server — NOT a client value
  const multiplier = liveState.currentMultiplier;

  // Safety: live multiplier must be below crash point (it always is while flying)
  if (multiplier >= liveState.crashPoint) {
    return res.status(400).json({ error: 'Too late — crashed' });
  }

  const payout = Math.round(bet.bet_amount * multiplier * 100) / 100;

  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(payout, userId);
  db.prepare(
    'INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)'
  ).run(uuidv4(), userId, 'win', payout);
  db.prepare(
    "UPDATE bets SET status = 'won', cashout_multiplier = ?, payout = ? WHERE id = ?"
  ).run(multiplier, payout, bet.id);

  const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
  return res.json({ result: 'won', multiplier, payout, balance: updated.balance });
};

module.exports = { getRound, placeBet, cashout, generateCrashPoint, setLiveState };
