/**
 * leaderboardController.js
 * Computes a top-players ranking by NET profit (sum of payouts - sum of bets)
 * over named accounts. Demo mode: if fewer than 5 real players exist, the list
 * is padded with stable fictional players so the board never looks empty.
 */

const db = require('../db/database');

// Stable demo names + seeded-ish net values so the board is plausible & steady.
const DEMO_PLAYERS = [
  { name: 'AviatorPro', net: 12845.5 }, { name: 'CrashKing', net: 9472.2 },
  { name: 'LuckyLina', net: 6128.8 }, { name: 'RocketMan', net: 4331.1 },
  { name: 'BetMaster', net: 3186.6 }, { name: 'SkyHigh', net: 2014.4 },
  { name: 'CashFlow', net: 1569.9 }, { name: 'MoonShot', net: 1422.3 },
  { name: 'HighRoller', net: 1288.0 }, { name: 'GoldenJet', net: 1175.6 },
  { name: 'TurboWin', net: 1043.2 }, { name: 'NeoPilot', net: 988.1 },
  { name: 'BlazeX', net: 921.7 }, { name: 'VegasVibe', net: 874.5 },
  { name: 'QuickCash', net: 812.9 }, { name: 'SkyWalker', net: 766.4 },
  { name: 'AceFlyer', net: 701.0 }, { name: 'BigBetBoss', net: 658.3 },
  { name: 'CryptoCat', net: 612.7 }, { name: 'DiamondHnd', net: 577.2 },
  { name: 'FastLane', net: 533.8 }, { name: 'GreenLight', net: 498.1 },
  { name: 'JackpotJoe', net: 461.5 }, { name: 'KingPin', net: 432.0 },
  { name: 'LunarBet', net: 401.6 }, { name: 'MaxMultiX', net: 376.9 },
  { name: 'NightHawk', net: 348.2 }, { name: 'OmegaWin', net: 319.7 },
  { name: 'PrimeFlyer', net: 294.4 }, { name: 'RapidRise', net: 271.0 },
  { name: 'StarDust', net: 248.6 }, { name: 'ThunderX', net: 226.3 },
  { name: 'UltraBet', net: 203.9 }, { name: 'VortexWin', net: 188.1 },
  { name: 'WildCard', net: 167.5 }, { name: 'XtremeCash', net: 149.8 },
  { name: 'YoloFlyer', net: 132.4 }, { name: 'ZenGambler', net: 118.7 },
  { name: 'SilverFox', net: 101.2 }, { name: 'BronzeBolt', net: 88.6 },
];

const BOARD_SIZE = 40;

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
         LIMIT 40`
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
    if (padded.length >= BOARD_SIZE) break;
    if (realNames.has(d.name.toLowerCase())) continue;
    padded.push({ name: d.name, net: d.net, rounds: 0, real: false });
  }

  // Final sort by net desc (mix real + demo) and rank.
  padded.sort((a, b) => b.net - a.net);
  const ranked = padded.slice(0, BOARD_SIZE).map((p, i) => ({ rank: i + 1, ...p }));

  return res.json({ leaderboard: ranked });
};

module.exports = { getLeaderboard };
