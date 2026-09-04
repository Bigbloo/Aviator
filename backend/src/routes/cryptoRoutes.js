/**
 * cryptoRoutes.js
 * USDT (TRC-20) deposit & withdrawal routes.
 */

const express = require('express');
const router = express.Router();
const {
  createDeposit, getDeposit, handleIpn, mockConfirm, createWithdrawal, listCurrencies,
} = require('../controllers/cryptoController');
const { requireAuth, requireVerifiedEmail } = require('../middleware/auth');

const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not found' });
  return next();
};

// Listing currencies and polling a deposit you already opened stay ungated —
// they move no money, and blocking the poll would strand an address the player
// may already have sent to.
router.get('/crypto/currencies', requireAuth, listCurrencies);
router.get('/crypto/deposit/:id', requireAuth, getDeposit);

// Opening a deposit address and requesting a payout both require a confirmed
// email. Deposits are gated too, deliberately: taking money from an account
// that could not withdraw it later is the worse outcome.
router.post('/crypto/deposit', requireAuth, requireVerifiedEmail, createDeposit);
router.post('/crypto/withdraw', requireAuth, requireVerifiedEmail, createWithdrawal);

// Provider webhook (public, HMAC-verified inside the handler).
router.post('/crypto/ipn', handleIpn);

// DEV ONLY: simulate a confirmed deposit (blocked in production).
router.post('/crypto/_mock/confirm', devOnly, requireAuth, mockConfirm);

module.exports = router;
