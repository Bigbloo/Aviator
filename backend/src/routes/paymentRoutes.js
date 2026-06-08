/**
 * paymentRoutes.js
 * Routes for Stripe payments and withdrawals.
 */

const express = require('express');
const router = express.Router();
const {
  createPaymentIntent,
  handleWebhook,
  simulateDeposit,
  withdraw,
} = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth');

// Reject dev-only endpoints in production (fake money / no real payment).
const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  return next();
};

// Stripe webhook — must use raw body (configured in index.js). Public, but
// authenticated by Stripe's signature inside the controller.
router.post('/webhook', handleWebhook);

// Create Stripe PaymentIntent — user from token
router.post('/create-payment-intent', requireAuth, createPaymentIntent);

// DEV ONLY: simulate deposit without Stripe (blocked in production)
router.post('/deposit/simulate', devOnly, requireAuth, simulateDeposit);

// Withdrawal — user from token
router.post('/withdraw', requireAuth, withdraw);

module.exports = router;
