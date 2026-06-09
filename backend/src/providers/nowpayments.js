/**
 * providers/nowpayments.js
 * NOWPayments adapter for the crypto money layer.
 */

const crypto = require('crypto');

const API = 'https://api.nowpayments.io/v1';
const API_KEY = process.env.NOWPAYMENTS_API_KEY;
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;
const callbackUrl = () => (process.env.PUBLIC_API_URL || '') + '/api/crypto/ipn';

// generic code → NOWPayments native code (identity, our codes match theirs)
const NATIVE = {
  usdttrc20: 'usdttrc20', usdterc20: 'usdterc20', usdtbsc: 'usdtbsc',
  btc: 'btc', eth: 'eth', bnbbsc: 'bnbbsc', sol: 'sol', trx: 'trx',
  ltc: 'ltc', usdcsol: 'usdcsol', xmr: 'xmr', doge: 'doge',
};

const sortDeep = (obj) => {
  if (Array.isArray(obj)) return obj.map(sortDeep);
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((a, k) => { a[k] = sortDeep(obj[k]); return a; }, {});
  }
  return obj;
};

module.exports = {
  name: 'nowpayments',
  available: () => !!API_KEY,
  supports: (g) => g in NATIVE,

  async createDeposit({ amount, genericCode, orderId }) {
    const r = await fetch(`${API}/payment`, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: 'usd',
        pay_currency: NATIVE[genericCode],
        order_id: orderId,
        ipn_callback_url: callbackUrl(),
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || 'Erreur du prestataire de paiement.');
    return { address: d.pay_address, payAmount: d.pay_amount, paymentId: String(d.payment_id) };
  },

  async parseCallback(req) {
    const sig = req.headers['x-nowpayments-sig'];
    if (!IPN_SECRET) return null;
    const expected = crypto.createHmac('sha512', IPN_SECRET)
      .update(JSON.stringify(sortDeep(req.body))).digest('hex');
    if (!sig || sig !== expected) return null;
    const { order_id, payment_status } = req.body;
    return {
      orderId: order_id,
      paid: ['finished', 'confirmed'].includes(payment_status),
      failed: ['failed', 'expired', 'refunded'].includes(payment_status),
    };
  },
};
