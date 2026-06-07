/**
 * gameController.js
 * Handles game rounds and bet resolution.
 * Crash point is generated server-side using an exponential distribution.
 *
 * Bet flow (two-phase):
 *  Phase 1 — POST /api/bet without cashoutMultiplier (or cashoutMultiplier=0):
 *    → Deducts balance, inserts bet with status='pending'
 *  Phase 2 — POST /api/bet with cashoutMultiplier > 0:
 *    → Resolves existing pending bet OR creates+resolves in one call
 *    → Checks cashoutMultiplier <= crashPoint to determine win/loss
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
 * Body: { userId, roundId, betAmount, cashoutMultiplier? }
 *
 * Two modes:
 *  - cashoutMultiplier = 0 or missing → Place bet (deduct balance, status=pending)
 *  - cashoutMultiplier > 0 → Cashout: resolve existing pending bet or create+resolve
 */
const placeBet = (req, res) => {
  const { userId, roundId, betAmount, cashoutMultiplier } = req.body;

  // Validate required fields
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

  // ── Phase 1: Place bet (no cashout yet) ──────────────────────────────────
  if (parsedCashout === 0) {
    // Check round is still active
    if (round.status !== 'active') {
      return res.status(400).json({ error: 'Round is no longer active' });
    }

    // Check for existing pending bet (prevent double-bet)
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

    // Deduct bet from balance
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

  // ── Phase 2: Cashout ──────────────────────────────────────────────────────
  if (parsedCashout < 1.0) {
    return res.status(400).json({ error: 'cashoutMultiplier must be >= 1.0' });
  }

  // Find existing pending bet for this user+round
  const pendingBet = db.prepare(
    "SELECT * FROM bets WHERE user_id = ? AND round_id = ? AND status = 'pending'"
  ).get(userId, roundId);

  if (!pendingBet) {
    return res.status(400).json({ error: 'No pending bet found for this round' });
  }

  const won = parsedCashout <= round.crash_point;

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
    console.log(`[Cashout] User ${userId} won ${payout}€ at x${parsedCashout} (crash: x${round.crash_point})`);
    return res.json({ result: 'won', payout, balance: updated.balance });
  } else {
    // Cashed out after crash — lost
    db.prepare(
      "UPDATE bets SET cashout_multiplier = ?, payout = 0, status = 'lost' WHERE id = ?"
    ).run(parsedCashout, pendingBet.id);

    const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    console.log(`[Cashout] User ${userId} lost — cashed at x${parsedCashout} but crash was x${round.crash_point}`);
    return res.json({ result: 'lost', payout: 0, balance: updated.balance });
  }
};

module.exports = { startRound, getRound, placeBet, generateCrashPoint };
