/**
 * gameController.js
 * Handles game rounds and bet resolution.
 *
 * Crash point formula: Math.max(1.0, 1.0 / (1.0 - Math.random()) ** 0.8)
 * → realistic distribution, mean ~2.5, max capped at 1000.
 *
 * Bet flow (two-phase):
 *  Phase 1 — POST /api/bet without cashoutMultiplier (or cashoutMultiplier=0):
 *    → Deducts balance, inserts bet with status='pending'
 *  Phase 2 — socket event 'cashout' { userId, roundId, betAmount, multiplierAtCashout }:
 *    → Verifies multiplierAtCashout < crashPoint (strictly less — equal = crash)
 *    → Calculates gain = betAmount * multiplierAtCashout, updates balance
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

/**
 * Generates a crash point with realistic distribution.
 * Formula: Math.max(1.0, 1.0 / (1.0 - Math.random()) ** 0.8)
 * Mean ≈ 2.5, capped at 1000.
 */
const generateCrashPoint = () => {
  const r = Math.random();
  const crash = Math.max(1.0, 1.0 / Math.pow(1.0 - r, 0.8));
  return Math.min(1000, Math.round(crash * 100) / 100);
};

/**
 * POST /api/round/start
 * Starts a new game round. Generates and stores the crash point server-side.
 * Returns roundId (crash point is hidden from client until crash).
 */
const startRound = (req, res) => {
  db.prepare(
    "UPDATE rounds SET status = 'crashed', ended_at = strftime('%s', 'now') WHERE status = 'active'"
  ).run();

  const roundId = uuidv4();
  const crashPoint = generateCrashPoint();

  db.prepare(
    'INSERT INTO rounds (id, crash_point, status) VALUES (?, ?, ?)'
  ).run(roundId, crashPoint, 'active');

  console.log(`[Round ${roundId}] Started — crash at x${crashPoint}`);
  return res.json({ roundId, startedAt: Date.now() });
};

/**
 * GET /api/round/current
 * Returns the currently active round state (for reconnection recovery).
 * Does NOT reveal crashPoint.
 */
const getCurrentRound = (req, res) => {
  const round = db.prepare("SELECT * FROM rounds WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get();
  if (!round) {
    return res.json({ phase: 'waiting', roundId: null });
  }
  return res.json({
    phase: 'flying',
    roundId: round.id,
    startedAt: round.started_at,
  });
};

/**
 * GET /api/round/:roundId
 * Returns round info. Crash point is revealed only after crash.
 */
const getRound = (req, res) => {
  const { roundId } = req.params;
  const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(roundId);
  if (!round) return res.status(404).json({ error: 'Round not found' });

  const response = {
    roundId: round.id,
    status: round.status,
    startedAt: round.started_at,
  };

  if (round.status === 'crashed') {
    response.crashPoint = round.crash_point;
  }

  return res.json(response);
};

/**
 * POST /api/bet
 * Body: { userId, roundId, betAmount }
 * Phase 1 only — deducts balance, records pending bet.
 * Cashout is handled via socket event 'cashout'.
 */
const placeBet = (req, res) => {
  const { userId, roundId, betAmount, cashoutMultiplier } = req.body;

  if (!userId || !roundId) {
    return res.status(400).json({ error: 'userId and roundId are required' });
  }

  const parsedBetAmount = parseFloat(betAmount);
  if (isNaN(parsedBetAmount) || parsedBetAmount <= 0) {
    return res.status(400).json({ error: 'betAmount must be a positive number' });
  }

  const parsedCashout = parseFloat(cashoutMultiplier) || 0;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(roundId);
  if (!round) return res.status(404).json({ error: 'Round not found' });

  // ── Phase 1: Place bet ────────────────────────────────────────────────────
  if (parsedCashout === 0) {
    if (round.status !== 'active') {
      return res.status(400).json({ error: 'Round is no longer active' });
    }

    const existingBet = db.prepare(
      "SELECT id FROM bets WHERE user_id = ? AND round_id = ? AND status = 'pending'"
    ).get(userId, roundId);
    if (existingBet) {
      const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
      return res.json({ result: 'pending', payout: 0, balance: updated.balance });
    }

    if (user.balance < parsedBetAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(parsedBetAmount, userId);
    db.prepare(
      'INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), userId, 'bet', -parsedBetAmount);

    const betId = uuidv4();
    db.prepare(
      'INSERT INTO bets (id, user_id, round_id, bet_amount, payout, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(betId, userId, roundId, parsedBetAmount, 0, 'pending');

    const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    console.log(`[Bet] User ${userId} placed ${parsedBetAmount}€ on round ${roundId}`);
    return res.json({ result: 'pending', payout: 0, balance: updated.balance });
  }

  // ── Phase 2: REST cashout (legacy fallback) ───────────────────────────────
  if (parsedCashout < 1.0) {
    return res.status(400).json({ error: 'cashoutMultiplier must be >= 1.0' });
  }

  const pendingBet = db.prepare(
    "SELECT * FROM bets WHERE user_id = ? AND round_id = ? AND status = 'pending'"
  ).get(userId, roundId);

  if (!pendingBet) {
    return res.status(400).json({ error: 'No pending bet found for this round' });
  }

  // Strictly less than crashPoint — equal means crash
  const won = parsedCashout < round.crash_point;

  if (won) {
    const payout = Math.round(parsedBetAmount * parsedCashout * 100) / 100;
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(payout, userId);
    db.prepare(
      'INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), userId, 'win', payout);
    db.prepare(
      "UPDATE bets SET cashout_multiplier = ?, payout = ?, status = 'won' WHERE id = ?"
    ).run(parsedCashout, payout, pendingBet.id);

    const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    console.log(`[Cashout REST] User ${userId} won ${payout}€ at x${parsedCashout}`);
    return res.json({ result: 'won', payout, balance: updated.balance });
  } else {
    db.prepare(
      "UPDATE bets SET cashout_multiplier = ?, payout = 0, status = 'lost' WHERE id = ?"
    ).run(parsedCashout, pendingBet.id);
    const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    return res.json({ result: 'lost', payout: 0, balance: updated.balance });
  }
};

/**
 * Resolves a cashout triggered via socket event.
 * Returns { result, payout, balance } or throws on error.
 */
const resolveCashout = ({ userId, roundId, betAmount, multiplierAtCashout }) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found');

  const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(roundId);
  if (!round) throw new Error('Round not found');

  const pendingBet = db.prepare(
    "SELECT * FROM bets WHERE user_id = ? AND round_id = ? AND status = 'pending'"
  ).get(userId, roundId);
  if (!pendingBet) throw new Error('No pending bet found');

  const parsedAmount = parseFloat(betAmount);
  const parsedMultiplier = parseFloat(multiplierAtCashout);

  // Strictly less than crashPoint — equal = crash
  const won = parsedMultiplier < round.crash_point;

  if (won) {
    const payout = Math.round(parsedAmount * parsedMultiplier * 100) / 100;
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(payout, userId);
    db.prepare(
      'INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), userId, 'win', payout);
    db.prepare(
      "UPDATE bets SET cashout_multiplier = ?, payout = ?, status = 'won' WHERE id = ?"
    ).run(parsedMultiplier, payout, pendingBet.id);

    const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    console.log(`[Cashout Socket] User ${userId} won ${payout}€ at x${parsedMultiplier} (crash: x${round.crash_point})`);
    return { result: 'won', payout, balance: updated.balance };
  } else {
    db.prepare(
      "UPDATE bets SET cashout_multiplier = ?, payout = 0, status = 'lost' WHERE id = ?"
    ).run(parsedMultiplier, pendingBet.id);
    const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    console.log(`[Cashout Socket] User ${userId} lost — cashed at x${parsedMultiplier} but crash was x${round.crash_point}`);
    return { result: 'lost', payout: 0, balance: updated.balance };
  }
};

module.exports = { startRound, getCurrentRound, getRound, placeBet, generateCrashPoint, resolveCashout };
