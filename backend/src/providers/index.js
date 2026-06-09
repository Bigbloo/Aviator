/**
 * providers/index.js
 * Selects the active crypto payment provider from PAYMENT_PROVIDER
 * (nowpayments | plisio). Switch providers with a single env var.
 */

const nowpayments = require('./nowpayments');
const plisio = require('./plisio');

const ALL = { nowpayments, plisio };
const selected = (process.env.PAYMENT_PROVIDER || 'nowpayments').toLowerCase();

module.exports = ALL[selected] || nowpayments;
