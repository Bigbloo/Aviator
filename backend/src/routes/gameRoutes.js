/**
 * gameRoutes.js
 * Routes for game rounds and bets.
 */

const express = require('express');
const router = express.Router();
const { getRound, placeBet, cashout, getMyBets, getFairRounds } = require('../controllers/gameController');
const { requireAuth } = require('../middleware/auth');

router.get('/round/:roundId', getRound);          // public, read-only
router.get('/fair/rounds', getFairRounds);        // public, Provably Fair history
router.post('/bet', requireAuth, placeBet);
router.post('/cashout', requireAuth, cashout);
router.get('/me/bets', requireAuth, getMyBets);

module.exports = router;
