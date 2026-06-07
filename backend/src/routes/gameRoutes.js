/**
 * gameRoutes.js
 * Routes for game rounds and bets.
 */

const express = require('express');
const router = express.Router();
const { startRound, getRound, placeBet } = require('../controllers/gameController');

router.post('/round/start', startRound);
router.get('/round/:roundId', getRound);
router.post('/bet', placeBet);

module.exports = router;
