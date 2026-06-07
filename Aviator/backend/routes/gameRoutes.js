const express = require('express');
const { getBalance, withdraw, getCurrentRound, bet } = require('../controllers/gameController');

const router = express.Router();

router.get('/balance/:userId', getBalance);
router.post('/withdraw', withdraw);
router.post('/bet', bet);
router.get('/round/current', getCurrentRound);

module.exports = router;
