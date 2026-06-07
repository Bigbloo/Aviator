const express = require('express');
const { createPaymentIntent, webhook } = require('../controllers/paymentController');

const router = express.Router();

router.post('/create-payment-intent', createPaymentIntent);
router.post('/webhook', webhook);

module.exports = router;
