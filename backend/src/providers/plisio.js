/**
 * providers/plisio.js
 * Plisio adapter. Deposits via white-label invoices (direct address). Callbacks
 * are verified by re-querying Plisio's operation status with our key (robust,
 * no PHP-serialize hash needed).
 */

const API = 'https://api.plisio.net/api/v1';
const KEY = process.env.PLISIO_SECRET;
const callbackUrl = () => (process.env.PUBLIC_API_URL || '') + '/api/crypto/ipn';

// generic code → Plisio currency code (psys cid). Adjust here if a code differs
// for your account (Plisio shows them in Settings → supported currencies).
const NATIVE = {
  usdttrc20: 'USDT_TRX',
  usdterc20: 'USDT',
  usdtbsc: 'USDT_BSC',
  btc: 'BTC',
  eth: 'ETH',
  bnbbsc: 'BNB',
  sol: 'SOL',
  trx: 'TRX',
  ltc: 'LTC',
  xmr: 'XMR',
  doge: 'DOGE',
};

module.exports = {
  name: 'plisio',
  available: () => !!KEY,
  supports: (g) => g in NATIVE,

  // Hosted-invoice flow: the player pays on Plisio's secure page (picks the
  // crypto + network there). Returns an invoiceUrl the frontend redirects to.
  async createDeposit({ amount, orderId }) {
    const params = new URLSearchParams({
      api_key: KEY,
      order_number: orderId,
      order_name: 'Aviator deposit',
      source_currency: 'USD',
      source_amount: String(amount),
      callback_url: callbackUrl(),
      expire_min: '30',
    });
    const r = await fetch(`${API}/invoices/new?${params.toString()}`);
    const d = await r.json();
    if (!d || d.status !== 'success' || !d.data) {
      throw new Error((d && d.data && d.data.message) || 'Erreur Plisio.');
    }
    const data = d.data;
    return {
      address: data.wallet_hash || null,   // null in hosted mode (no white-label)
      payAmount: data.amount ? Number(data.amount) : null,
      paymentId: String(data.txn_id),
      invoiceUrl: data.invoice_url,
    };
  },

  async parseCallback(req) {
    const body = req.body || {};
    const txn = body.txn_id || body.id;
    if (!txn) return null;
    // Authoritative re-check against Plisio (attacker can't forge our txn status).
    try {
      const r = await fetch(`${API}/operations/${encodeURIComponent(txn)}?api_key=${KEY}`);
      const d = await r.json();
      if (!d || d.status !== 'success' || !d.data) return null;
      const st = d.data.status;
      const orderId = body.order_number || d.data.order_number;
      return {
        orderId,
        paid: ['completed', 'mismatch'].includes(st),
        failed: ['expired', 'cancelled', 'error'].includes(st),
      };
    } catch (e) {
      return null;
    }
  },
};
