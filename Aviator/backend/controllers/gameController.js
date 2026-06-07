const db = require('../db');
const { startRound, getCurrentRound, getRoundById, getCurrentMultiplier } = require('../services/roundService');

function ensureUser(userId) {
  const existing = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(userId);
  if (!existing) db.prepare('INSERT INTO users (user_id, balance) VALUES (?, 0)').run(userId);
}

exports.getBalance = (req, res) => {
  const { userId } = req.params;
  ensureUser(userId);
  const row = db.prepare('SELECT balance FROM users WHERE user_id = ?').get(userId);
  res.json({ balance: Number(row.balance.toFixed(2)) });
};

exports.withdraw = (req, res) => {
  const { userId, amount, stripeAccountId } = req.body;
  if (!userId || !amount) return res.status(400).json({ error: 'userId and amount are required' });

  ensureUser(userId);

  const user = db.prepare('SELECT balance FROM users WHERE user_id = ?').get(userId);
  if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

  db.prepare('UPDATE users SET balance = balance - ? WHERE user_id = ?').run(amount, userId);
  const message = `Simulated withdrawal of ${amount} for ${userId} to ${stripeAccountId || 'N/A'}`;
  db.prepare('INSERT INTO withdrawals (user_id, amount, stripe_account_id, status, message) VALUES (?, ?, ?, ?, ?)')
    .run(userId, amount, stripeAccountId || '', 'simulated', message);

  const updated = db.prepare('SELECT balance FROM users WHERE user_id = ?').get(userId);
  res.json({ success: true, message, balance: Number(updated.balance.toFixed(2)) });
};

exports.startRound = (req, res) => {
  const round = startRound();
  res.json({ roundId: round.id });
};

exports.roundMultiplier = (req, res) => {
  const roundId = Number(req.params.roundId);
  const round = getRoundById(roundId);
  if (!round) return res.status(404).json({ error: 'Round not found' });

  if (round.status !== 'running') {
    return res.json({ multiplier: round.crash_point, crashed: true, crashPoint: round.crash_point });
  }

  const currentRound = getCurrentRound();
  const multiplier = getCurrentMultiplier(currentRound);
  const crashed = multiplier >= currentRound.crashPoint;

  res.json({ multiplier, crashed, crashPoint: crashed ? currentRound.crashPoint : null });
};

exports.bet = (req, res) => {
  const { userId, betAmount, cashoutMultiplier } = req.body;
  if (!userId || !betAmount || !cashoutMultiplier) {
    return res.status(400).json({ error: 'userId, betAmount and cashoutMultiplier are required' });
  }

  ensureUser(userId);

  const round = getCurrentRound();
  if (!round) return res.status(400).json({ error: 'No active round' });

  const user = db.prepare('SELECT balance FROM users WHERE user_id = ?').get(userId);
  if (user.balance < betAmount) return res.status(400).json({ error: 'Insufficient balance' });

  db.prepare('UPDATE users SET balance = balance - ? WHERE user_id = ?').run(betAmount, userId);

  const won = cashoutMultiplier <= round.crashPoint;
  const payout = won ? Number((betAmount * cashoutMultiplier).toFixed(2)) : 0;

  if (won) {
    db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?').run(payout, userId);
  }

  db.prepare('INSERT INTO bets (user_id, round_id, bet_amount, cashout_multiplier, won, payout) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, round.id, betAmount, cashoutMultiplier, won ? 1 : 0, payout);

  const updated = db.prepare('SELECT balance FROM users WHERE user_id = ?').get(userId);

  res.json({
    won,
    payout,
    crashPoint: round.crashPoint,
    balance: Number(updated.balance.toFixed(2))
  });
};
