const express = require('express');
const { getBalance, withdraw, startRound, roundMultiplier, bet } = require('../controllers/gameController');

const router = express.Router();

router.get('/balance/:userId', getBalance);
router.post('/withdraw', withdraw);
router.post('/bet', bet);
router.post('/round/start', startRound);
router.get('/round/:roundId/multiplier', roundMultiplier);

module.exports = router;
