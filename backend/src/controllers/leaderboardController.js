/**
 * leaderboardController.js
 * GET /api/leaderboard — the "Top Winners" board: the biggest wins (bet ×
 * multiplier → payout), fed by real round results and kept lively over time.
 */

const topWins = require('../topWins');

const getLeaderboard = (req, res) => {
  const ranked = topWins.list().map((w, i) => ({ rank: i + 1, ...w }));
  return res.json({ leaderboard: ranked });
};

module.exports = { getLeaderboard };
