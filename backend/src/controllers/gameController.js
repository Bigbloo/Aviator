/**
 * gameController.js
 * Handles game rounds and bet resolution.
 *
 * Features:
 *  - Seed individualisé : chaque round a une graine unique (sessionSeed + serverSeed)
 *  - Crash asynchrone progressif : courbe de tension avec ralentissement puis accélération
 *  - Classement dynamique par créneau de 15 minutes
 *  - Option de revanche forcée : mise doublée après un échec
 *  - Proposition automatique de montant maximal après N pertes consécutives
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db/database');

// ── Seed individualisé ────────────────────────────────────────────────────────
/**
 * Génère un crash point déterministe à partir d'une graine unique par session.
 * Chaque utilisateur a son propre moment de crash.
 * @param {string} sessionSeed - graine unique de la session utilisateur
 * @param {string} serverSeed  - graine serveur du round
 */
const generateSeededCrashPoint = (sessionSeed, serverSeed) => {
  const combined = `${serverSeed}:${sessionSeed}`;
  const hash = crypto.createHmac('sha256', combined).update('aviator').digest('hex');
  // Convertir les 8 premiers chars hex en float [0, 1)
  const r = parseInt(hash.slice(0, 8), 16) / 0xffffffff;
  const crash = Math.max(1.0, 1.0 / Math.pow(1.0 - r, 0.8));
  return Math.min(1000, Math.round(crash * 100) / 100);
};

/**
 * Génère un crash point aléatoire standard (pour le round global).
 */
const generateCrashPoint = () => {
  const r = Math.random();
  const crash = Math.max(1.0, 1.0 / Math.pow(1.0 - r, 0.8));
  return Math.min(1000, Math.round(crash * 100) / 100);
};

// ── Crash asynchrone progressif ───────────────────────────────────────────────
/**
 * Calcule la "tension" du multiplicateur à un instant t.
 * La courbe ralentit entre 1.5x et 3x, puis accélère brutalement.
 * Retourne un facteur multiplicatif pour le MULTIPLIER_STEP.
 * @param {number} multiplier - multiplicateur actuel
 */
const getTensionFactor = (multiplier) => {
  if (multiplier < 1.5) return 1.0;          // montée normale
  if (multiplier < 2.0) return 0.6;          // ralentissement — tension monte
  if (multiplier < 2.5) return 0.4;          // ralentissement max — faux espoir
  if (multiplier < 3.0) return 0.7;          // légère reprise
  if (multiplier < 5.0) return 1.2;          // accélération — danger
  return 1.8;                                 // accélération brutale
};

// ── Classement dynamique par créneau de 15 minutes ───────────────────────────
/**
 * GET /api/leaderboard/slot
 * Retourne le classement des joueurs sur le créneau de 15 min actuel.
 */
const getSlotLeaderboard = (req, res) => {
  try {
    // Créneau de 15 min : timestamp arrondi au quart d'heure
    const now = Math.floor(Date.now() / 1000);
    const slotStart = now - (now % 900); // 900s = 15min

    const rows = db.prepare(`
      SELECT
        u.id as userId,
        'Joueur ' || substr(u.id, 1, 6) as username,
        SUM(CASE WHEN b.status = 'won' THEN b.payout - b.bet_amount ELSE -b.bet_amount END) as netGain,
        COUNT(b.id) as totalBets,
        SUM(CASE WHEN b.status = 'won' THEN 1 ELSE 0 END) as wins
      FROM bets b
      JOIN users u ON u.id = b.user_id
      JOIN rounds r ON r.id = b.round_id
      WHERE r.started_at >= ?
      GROUP BY u.id
      ORDER BY netGain DESC
      LIMIT 20
    `).all(slotStart);

    return res.json({
      slotStart,
      slotEnd: slotStart + 900,
      leaderboard: rows,
    });
  } catch (err) {
    console.error('[Leaderboard]', err.message);
    return res.status(500).json({ error: 'Leaderboard unavailable' });
  }
};

/**
 * GET /api/leaderboard/slot/:userId
 * Retourne la position et l'écart d'un joueur par rapport aux pairs.
 */
const getUserSlotRank = (req, res) => {
  try {
    const { userId } = req.params;
    const now = Math.floor(Date.now() / 1000);
    const slotStart = now - (now % 900);

    const rows = db.prepare(`
      SELECT
        u.id as userId,
        SUM(CASE WHEN b.status = 'won' THEN b.payout - b.bet_amount ELSE -b.bet_amount END) as netGain
      FROM bets b
      JOIN users u ON u.id = b.user_id
      JOIN rounds r ON r.id = b.round_id
      WHERE r.started_at >= ?
      GROUP BY u.id
      ORDER BY netGain DESC
    `).all(slotStart);

    const rank = rows.findIndex(r => r.userId === userId) + 1;
    const userRow = rows.find(r => r.userId === userId);
    const leader = rows[0];

    return res.json({
      rank: rank || null,
      total: rows.length,
      netGain: userRow?.netGain ?? 0,
      gapToLeader: leader ? (leader.netGain - (userRow?.netGain ?? 0)) : 0,
      gapToNext: rank > 1 ? (rows[rank - 2]?.netGain ?? 0) - (userRow?.netGain ?? 0) : 0,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Rank unavailable' });
  }
};

// ── Revanche forcée ───────────────────────────────────────────────────────────
/**
 * POST /api/revenge
 * Body: { userId, roundId }
 * Après une perte, propose une mise doublée unique.
 * Marque la revanche comme utilisée pour éviter les abus.
 */
const revengebet = (req, res) => {
  const { userId, roundId } = req.body;
  if (!userId || !roundId) return res.status(400).json({ error: 'userId and roundId required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Vérifier la dernière mise perdue
  const lastLost = db.prepare(`
    SELECT * FROM bets
    WHERE user_id = ? AND status = 'lost'
    ORDER BY rowid DESC LIMIT 1
  `).get(userId);

  if (!lastLost) return res.status(400).json({ error: 'No recent loss found' });

  // Vérifier que la revanche n'a pas déjà été utilisée pour cette perte
  const alreadyUsed = db.prepare(`
    SELECT id FROM bets
    WHERE user_id = ? AND round_id = ? AND status = 'pending'
  `).get(userId, roundId);

  if (alreadyUsed) return res.status(400).json({ error: 'Revenge already used this round' });

  const revengeBet = Math.min(lastLost.bet_amount * 2, user.balance);
  if (revengeBet <= 0) return res.status(400).json({ error: 'Insufficient balance for revenge' });

  // Déduire et enregistrer
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(revengeBet, userId);
  db.prepare('INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)').run(
    uuidv4(), userId, 'bet', -revengeBet
  );
  const betId = uuidv4();
  db.prepare(
    'INSERT INTO bets (id, user_id, round_id, bet_amount, payout, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(betId, userId, roundId, revengeBet, 0, 'pending');

  const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
  console.log(`[Revenge] User ${userId} placed revenge bet ${revengeBet}€ on round ${roundId}`);
  return res.json({ result: 'pending', betAmount: revengeBet, balance: updated.balance });
};

// ── Suggestion de mise maximale ───────────────────────────────────────────────
/**
 * GET /api/suggest/:userId
 * Après N pertes consécutives, suggère la mise totale du solde.
 */
const suggestMaxBet = (req, res) => {
  const { userId } = req.params;
  const LOSS_THRESHOLD = 3; // nombre de pertes consécutives avant suggestion

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Récupérer les dernières mises
  const recentBets = db.prepare(`
    SELECT status FROM bets
    WHERE user_id = ?
    ORDER BY rowid DESC
    LIMIT 10
  `).all(userId);

  let consecutiveLosses = 0;
  for (const bet of recentBets) {
    if (bet.status === 'lost') consecutiveLosses++;
    else break;
  }

  const shouldSuggest = consecutiveLosses >= LOSS_THRESHOLD;

  return res.json({
    consecutiveLosses,
    shouldSuggest,
    suggestedAmount: shouldSuggest ? user.balance : null,
    message: shouldSuggest
      ? `Après ${consecutiveLosses} pertes, misez tout (${user.balance.toFixed(2)}€) pour un retour potentiel !`
      : null,
  });
};

// ── Seed de session ───────────────────────────────────────────────────────────
/**
 * GET /api/session-seed
 * Génère et retourne une graine unique pour la session utilisateur.
 */
const getSessionSeed = (req, res) => {
  const seed = crypto.randomBytes(16).toString('hex');
  return res.json({ seed });
};

// ── Round start / current / get ───────────────────────────────────────────────
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

const getCurrentRound = (req, res) => {
  const round = db.prepare("SELECT * FROM rounds WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get();
  if (!round) return res.json({ phase: 'waiting', roundId: null });
  return res.json({ phase: 'flying', roundId: round.id, startedAt: round.started_at });
};

const getRound = (req, res) => {
  const { roundId } = req.params;
  const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(roundId);
  if (!round) return res.status(404).json({ error: 'Round not found' });

  const response = { roundId: round.id, status: round.status, startedAt: round.started_at };
  if (round.status === 'crashed') response.crashPoint = round.crash_point;
  return res.json(response);
};

// ── Place bet ─────────────────────────────────────────────────────────────────
const placeBet = (req, res) => {
  const { userId, roundId, betAmount, cashoutMultiplier } = req.body;

  if (!userId || !roundId) return res.status(400).json({ error: 'userId and roundId are required' });

  const parsedBetAmount = parseFloat(betAmount);
  if (isNaN(parsedBetAmount) || parsedBetAmount <= 0)
    return res.status(400).json({ error: 'betAmount must be a positive number' });

  const parsedCashout = parseFloat(cashoutMultiplier) || 0;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(roundId);
  if (!round) return res.status(404).json({ error: 'Round not found' });

  if (parsedCashout === 0) {
    if (round.status !== 'active') return res.status(400).json({ error: 'Round is no longer active' });

    const existingBet = db.prepare(
      "SELECT id FROM bets WHERE user_id = ? AND round_id = ? AND status = 'pending'"
    ).get(userId, roundId);
    if (existingBet) {
      const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
      return res.json({ result: 'pending', payout: 0, balance: updated.balance });
    }

    if (user.balance < parsedBetAmount) return res.status(400).json({ error: 'Insufficient balance' });

    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(parsedBetAmount, userId);
    db.prepare('INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)').run(
      uuidv4(), userId, 'bet', -parsedBetAmount
    );

    const betId = uuidv4();
    db.prepare(
      'INSERT INTO bets (id, user_id, round_id, bet_amount, payout, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(betId, userId, roundId, parsedBetAmount, 0, 'pending');

    const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    console.log(`[Bet] User ${userId} placed ${parsedBetAmount}€ on round ${roundId}`);
    return res.json({ result: 'pending', payout: 0, balance: updated.balance });
  }

  // Phase 2: REST cashout (legacy fallback)
  if (parsedCashout < 1.0) return res.status(400).json({ error: 'cashoutMultiplier must be >= 1.0' });

  const pendingBet = db.prepare(
    "SELECT * FROM bets WHERE user_id = ? AND round_id = ? AND status = 'pending'"
  ).get(userId, roundId);
  if (!pendingBet) return res.status(400).json({ error: 'No pending bet found for this round' });

  const won = parsedCashout < round.crash_point;

  if (won) {
    const payout = Math.round(parsedBetAmount * parsedCashout * 100) / 100;
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(payout, userId);
    db.prepare('INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)').run(
      uuidv4(), userId, 'win', payout
    );
    db.prepare("UPDATE bets SET cashout_multiplier = ?, payout = ?, status = 'won' WHERE id = ?").run(
      parsedCashout, payout, pendingBet.id
    );
    const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    return res.json({ result: 'won', payout, balance: updated.balance });
  } else {
    db.prepare("UPDATE bets SET cashout_multiplier = ?, payout = 0, status = 'lost' WHERE id = ?").run(
      parsedCashout, pendingBet.id
    );
    const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    return res.json({ result: 'lost', payout: 0, balance: updated.balance });
  }
};

// ── Resolve cashout (socket) ──────────────────────────────────────────────────
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
  const won = parsedMultiplier < round.crash_point;

  if (won) {
    const payout = Math.round(parsedAmount * parsedMultiplier * 100) / 100;
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(payout, userId);
    db.prepare('INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)').run(
      uuidv4(), userId, 'win', payout
    );
    db.prepare("UPDATE bets SET cashout_multiplier = ?, payout = ?, status = 'won' WHERE id = ?").run(
      parsedMultiplier, payout, pendingBet.id
    );
    const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    console.log(`[Cashout Socket] User ${userId} won ${payout}€ at x${parsedMultiplier} (crash: x${round.crash_point})`);
    return { result: 'won', payout, balance: updated.balance };
  } else {
    db.prepare("UPDATE bets SET cashout_multiplier = ?, payout = 0, status = 'lost' WHERE id = ?").run(
      parsedMultiplier, pendingBet.id
    );
    const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    console.log(`[Cashout Socket] User ${userId} lost — cashed at x${parsedMultiplier} but crash was x${round.crash_point}`);
    return { result: 'lost', payout: 0, balance: updated.balance };
  }
};

module.exports = {
  startRound,
  getCurrentRound,
  getRound,
  placeBet,
  generateCrashPoint,
  generateSeededCrashPoint,
  getTensionFactor,
  resolveCashout,
  getSlotLeaderboard,
  getUserSlotRank,
  revengebet,
  suggestMaxBet,
  getSessionSeed,
};
