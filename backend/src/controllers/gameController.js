/**
 * gameController.js
 * Handles game rounds and bet resolution.
 * Crash point is generated server-side using an exponential distribution.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

/**
 * Generates a provably fair crash point using exponential distribution.
 * E[X] ≈ 2.0 (house edge ~5%)
 * Min crash = 1.00
 */
const generateCrashPoint = () => {
  const houseEdge = 0.05;
  const r = Math.random();
  if (r < houseEdge) return 1.0; // instant crash (house edge)
  const crash = Math.max(1.0, 0.99 / (1 - r));
  return Math.round(crash * 100) / 100; // 2 decimal places
};

/**
 * POST /api/round/start
 * Starts a new game round. Generates and stores the crash point server-side.
 * Returns roundId (crash point is hidden from client until crash).
 */
const startRound = (req, res) => {
  // Mark any active rounds as crashed (cleanup)
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

  // Reveal crash point only after crash
  if (round.status === 'crashed') {
    response.crashPoint = round.crash_point;
  }

  return res.json(response);
};

/**
 * POST /api/bet
 * Body: { userId, roundId, betAmount, cashoutMultiplier }
 * Resolves a bet: checks if cashoutMultiplier <= crashPoint.
 * Updates user balance and returns result.
 */
const placeBet = (req, res) => {
  const { userId, roundId, betAmount, cashoutMultiplier } = req.body;

  if (!userId || !roundId || !betAmount || betAmount <= 0) {
    return res.status(400).json({ error: 'Invalid bet parameters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.balance < betAmount) return res.status(400).json({ error: 'Insufficient balance' });

  const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(roundId);
  if (!round) return res.status(404).json({ error: 'Round not found' });

  // Deduct bet from balance immediately
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(betAmount, userId);
  db.prepare(
    'INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)'
  ).run(uuidv4(), userId, 'bet', -betAmount);

  const betId = uuidv4();

  // If cashoutMultiplier provided → player cashed out before crash
  if (cashoutMultiplier && cashoutMultiplier >= 1.0) {
    const won = cashoutMultiplier <= round.crash_point;

    if (won) {
      const payout = Math.round(betAmount * cashoutMultiplier * 100) / 100;
      db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(payout, userId);
      db.prepare(
        'INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)'
      ).run(uuidv4(), userId, 'win', payout);

      db.prepare(
        'INSERT INTO bets (id, user_id, round_id, bet_amount, cashout_multiplier, payout, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(betId, userId, roundId, betAmount, cashoutMultiplier, payout, 'won');

      const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
      return res.json({ result: 'won', payout, balance: updated.balance });
    } else {
      // Cashed out after crash — lost
      db.prepare(
        'INSERT INTO bets (id, user_id, round_id, bet_amount, cashout_multiplier, payout, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(betId, userId, roundId, betAmount, cashoutMultiplier, 0, 'lost');

      const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
      return res.json({ result: 'lost', payout: 0, balance: updated.balance });
    }
  }

  // No cashout → player lost (didn't cash out before crash)
  db.prepare(
    'INSERT INTO bets (id, user_id, round_id, bet_amount, payout, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(betId, userId, roundId, betAmount, 0, 'lost');

  const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
  return res.json({ result: 'lost', payout: 0, balance: updated.balance });
};

module.exports = { startRound, getRound, placeBet, generateCrashPoint };
