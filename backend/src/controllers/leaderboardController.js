/**
 * leaderboardController.js
 * Computes a top-players ranking by NET profit (sum of payouts - sum of bets)
 * over named accounts. Demo mode: if fewer than 5 real players exist, the list
 * is padded with stable fictional players so the board never looks empty.
 */

const db = require('../db/database');

// Stable demo names + seeded-ish net values so the board is plausible & steady.
const DEMO_PLAYERS = [
  { name: 'AviatorPro', net: 1284.5 },
  { name: 'CrashKing', net: 947.2 },
  { name: 'LuckyLina', net: 612.8 },
  { name: 'RocketMan', net: 433.1 },
  { name: 'BetMaster', net: 318.6 },
  { name: 'SkyHigh', net: 201.4 },
  { name: 'CashFlow', net: 156.9 },
];

/**
 * GET /api/leaderboard
 * Returns top 10 players by net profit. Real named players first (settled bets
 * only — won/lost), padded with demo players to reach a full board.
 */
const getLeaderboard = (req, res) => {
  let real = [];
  try {
    real = db
      .prepare(
        `SELECT u.username AS name,
                COALESCE(SUM(b.payout), 0) - COALESCE(SUM(b.bet_amount), 0) AS net,
                COUNT(b.id) AS rounds
         FROM users u
         JOIN bets b ON b.user_id = u.id
         WHERE u.username IS NOT NULL
           AND b.status IN ('won', 'lost')
         GROUP BY u.id
         ORDER BY net DESC
         LIMIT 10`
      )
      .all()
      .map((r) => ({
        name: r.name,
        net: Math.round(r.net * 100) / 100,
        rounds: r.rounds,
        real: true,
      }));
  } catch (e) {
    console.error('[Leaderboard] query failed:', e.message);
  }

  // Pad with demo players (skip any whose name collides with a real one).
  const realNames = new Set(real.map((r) => r.name.toLowerCase()));
  const padded = [...real];
  for (const d of DEMO_PLAYERS) {
    if (padded.length >= 10) break;
    if (realNames.has(d.name.toLowerCase())) continue;
    padded.push({ name: d.name, net: d.net, rounds: 0, real: false });
  }

  // Final sort by net desc (mix real + demo) and rank.
  padded.sort((a, b) => b.net - a.net);
  const ranked = padded.slice(0, 10).map((p, i) => ({ rank: i + 1, ...p }));

  return res.json({ leaderboard: ranked });
};

module.exports = { getLeaderboard };
