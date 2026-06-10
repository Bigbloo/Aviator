/**
 * gameRoutes.js
 * Routes for game rounds, bets, leaderboard, revenge, suggestions, and session seed.
 */

const express = require('express');
const router = express.Router();
const {
  startRound,
  getCurrentRound,
  getRound,
  placeBet,
  getSlotLeaderboard,
  getUserSlotRank,
  revengebet,
  suggestMaxBet,
  getSessionSeed,
} = require('../controllers/gameController');

router.post('/round/start', startRound);
router.get('/round/current', getCurrentRound);
router.get('/round/:roundId', getRound);
router.post('/bet', placeBet);

// Classement dynamique par créneau de 15 minutes
router.get('/leaderboard/slot', getSlotLeaderboard);
router.get('/leaderboard/slot/:userId', getUserSlotRank);

// Revanche forcée (mise doublée après une perte)
router.post('/revenge', revengebet);

// Suggestion de mise maximale après N pertes consécutives
router.get('/suggest/:userId', suggestMaxBet);

// Seed individualisé de session
router.get('/session-seed', getSessionSeed);

module.exports = router;
