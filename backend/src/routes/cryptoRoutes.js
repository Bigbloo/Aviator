/**
 * cryptoRoutes.js
 * USDT (TRC-20) deposit & withdrawal routes.
 */

const express = require('express');
const router = express.Router();
const {
  createDeposit, getDeposit, handleIpn, mockConfirm, createWithdrawal,
} = require('../controllers/cryptoController');
const { requireAuth } = require('../middleware/auth');

const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not found' });
  return next();
};

router.post('/crypto/deposit', requireAuth, createDeposit);
router.get('/crypto/deposit/:id', requireAuth, getDeposit);
router.post('/crypto/withdraw', requireAuth, createWithdrawal);

// Provider webhook (public, HMAC-verified inside the handler).
router.post('/crypto/ipn', handleIpn);

// DEV ONLY: simulate a confirmed deposit (blocked in production).
router.post('/crypto/_mock/confirm', devOnly, requireAuth, mockConfirm);

module.exports = router;
