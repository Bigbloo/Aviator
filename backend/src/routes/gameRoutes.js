/**
 * gameRoutes.js
 * Routes for game rounds and bets.
 */

const express = require('express');
const router = express.Router();
const { getRound, placeBet, cashout } = require('../controllers/gameController');

router.get('/round/:roundId', getRound);
router.post('/bet', placeBet);
router.post('/cashout', cashout);

module.exports = router;
