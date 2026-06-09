/**
 * providers/plisio.js
 * Plisio adapter. Deposits via white-label invoices (direct address). Callbacks
 * are verified by re-querying Plisio's operation status with our key (robust,
 * no PHP-serialize hash needed).
 */

const API = 'https://api.plisio.net/api/v1';
const KEY = process.env.PLISIO_SECRET;
const callbackUrl = () => (process.env.PUBLIC_API_URL || '') + '/api/crypto/ipn';

// generic code → Plisio currency code (psys cid). ONLY the currencies enabled
// in the Plisio account (Settings → Supported currencies) are accepted at
// invoice creation. To add USDT TRC-20, enable "Tether TRC-20" in Plisio and
// add `usdttrc20: 'USDT_TRX'` here.
const NATIVE = {
  btc: 'BTC',
  ltc: 'LTC',
  xmr: 'XMR',
  sol: 'SOL',
  bnbbsc: 'BNB',
  ton: 'TON',
};

// Plisio's API errors are raw English JSON-ish strings (e.g. '{"amount":"Invalid
// minimal amount attribute value, it must be greater than: 2.918855808 TON"}').
// Translate the known ones into a clear French message for the player.
const friendlyError = (raw, native) => {
  if (!raw) return 'Erreur du prestataire de paiement. Réessaie dans un instant.';
  const msg = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const min = msg.match(/greater than:?\s*([\d.]+)\s*([A-Z_]+)/i);
  if (min) {
    const qty = Number(min[1]);
    const cur = (min[2] || native).replace('_', ' ');
    return `Montant trop faible pour cette crypto : le minimum est ${qty.toFixed(4)} ${cur}. Augmente le montant en USDT ou choisis une autre crypto.`;
  }
  if (/not supported|disabled|currency/i.test(msg)) {
    return 'Cette crypto est momentanément indisponible. Choisis-en une autre.';
  }
  return 'Erreur du prestataire de paiement. Réessaie dans un instant.';
};

module.exports = {
  name: 'plisio',
  available: () => !!KEY,
  supports: (g) => g in NATIVE,

  // White-label: returns a direct pay-in address (wallet_hash). Falls back to
  // the hosted invoice_url if white-label is off for the chosen currency.
  async createDeposit({ amount, genericCode, orderId }) {
    const native = NATIVE[genericCode];
    if (!native) throw new Error('Cette crypto n’est pas disponible.');
    const params = new URLSearchParams({
      api_key: KEY,
      order_number: orderId,
      order_name: 'Aviator deposit',
      source_currency: 'USD',
      source_amount: String(amount),
      currency: native,
      callback_url: callbackUrl(),
      expire_min: '30',
    });
    const r = await fetch(`${API}/invoices/new?${params.toString()}`);
    const d = await r.json();
    if (!d || d.status !== 'success' || !d.data) {
      throw new Error(friendlyError(d && d.data && d.data.message, native));
    }
    const data = d.data;
    return {
      address: data.wallet_hash || null,
      payAmount: data.amount ? Number(data.amount) : null,
      paymentId: String(data.txn_id),
      invoiceUrl: data.wallet_hash ? null : data.invoice_url,
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
      // Credit only on a clean 'completed' (within Plisio's underpayment
      // tolerance). 'mismatch' (under/overpayment) stays pending for review.
      return {
        orderId,
        paid: st === 'completed',
        failed: ['expired', 'cancelled', 'error'].includes(st),
      };
    } catch (e) {
      return null;
    }
  },
};
