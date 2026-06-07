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

// Stripe webhook — must use raw body (configured in index.js)
router.post('/webhook', handleWebhook);

// Create Stripe PaymentIntent
router.post('/create-payment-intent', createPaymentIntent);

// DEV: simulate deposit without Stripe
router.post('/deposit/simulate', simulateDeposit);

// Withdrawal (simulated in test mode)
router.post('/withdraw', withdraw);

module.exports = router;
