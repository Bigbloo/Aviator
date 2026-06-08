/**
 * cryptoController.js
 * USDT (TRC-20) deposits & withdrawals via NOWPayments.
 *
 * Mock mode: when NOWPAYMENTS_API_KEY is absent the whole flow runs locally
 * with fake addresses/tx hashes so it's fully testable end-to-end. Set the real
 * keys to switch to live on-chain payments — no code change needed.
 *
 *   NOWPAYMENTS_API_KEY     deposits + status
 *   NOWPAYMENTS_IPN_SECRET  verifies deposit webhooks (HMAC-SHA512)
 *   NOWPAYMENTS_PAYOUT_KEY  withdrawals (payout API)
 *   PUBLIC_API_URL          public base url for the IPN callback
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

const API = 'https://api.nowpayments.io/v1';
const API_KEY = process.env.NOWPAYMENTS_API_KEY;
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;
const PAYOUT_KEY = process.env.NOWPAYMENTS_PAYOUT_KEY;
const MOCK = !API_KEY;

// Tunables
const MIN_DEPOSIT = 15;           // USDT (NOWPayments min for usdttrc20 ≈ 11 + margin)
const MIN_WITHDRAW = 10;          // USDT
const MAX_AUTO_WITHDRAW = 1000;   // above this, hold for manual review (anti-abuse/AML)
const PAY_CURRENCY = 'usdttrc20';

// TRC-20 address: base58, starts with 'T', 34 chars total.
const TRC20_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

// Curated list of pay-in currencies offered to the player. The account balance
// stays in USDT; NOWPayments converts whatever they pay into that value.
const POPULAR = [
  { code: 'usdttrc20', name: 'USDT', network: 'TRC-20 (Tron)' },
  { code: 'usdterc20', name: 'USDT', network: 'ERC-20 (Ethereum)' },
  { code: 'usdtbsc',   name: 'USDT', network: 'BEP-20 (BSC)' },
  { code: 'btc',       name: 'Bitcoin', network: 'Bitcoin' },
  { code: 'eth',       name: 'Ethereum', network: 'ERC-20' },
  { code: 'bnbbsc',    name: 'BNB', network: 'BEP-20 (BSC)' },
  { code: 'sol',       name: 'Solana', network: 'Solana' },
  { code: 'trx',       name: 'TRON', network: 'Tron' },
  { code: 'ltc',       name: 'Litecoin', network: 'Litecoin' },
  { code: 'usdcsol',   name: 'USDC', network: 'Solana' },
  { code: 'xmr',       name: 'Monero', network: 'Monero' },
  { code: 'doge',      name: 'Dogecoin', network: 'Dogecoin' },
];
const POPULAR_CODES = new Set(POPULAR.map((c) => c.code));
const networkOf = (code) => (POPULAR.find((c) => c.code === code) || {}).network || code;

let _curCache = null;
let _curCacheAt = 0;

const now = () => Math.floor(Date.now() / 1000);

// ── Deposit crediting (idempotent) ────────────────────────────────────────────
/**
 * Marks a deposit finished and credits the user, exactly once. Guarded by the
 * status transition inside a single DB transaction, so a duplicate webhook is a
 * no-op.
 */
const creditDeposit = (depositId, paidInCrypto) => {
  const apply = db.transaction(() => {
    const dep = db.prepare('SELECT * FROM crypto_deposits WHERE id = ?').get(depositId);
    if (!dep) return { credited: false, reason: 'not_found' };
    if (dep.status === 'finished') return { credited: false, reason: 'already' };

    // Credit the requested USDT VALUE (dep.amount), not the raw crypto amount —
    // the player may have paid in BTC/ETH/etc. which NOWPayments converts.
    // `received` records the actual crypto amount for the audit trail.
    const credit = Number(dep.amount);
    db.prepare(
      "UPDATE crypto_deposits SET status='finished', received=?, updated_at=? WHERE id=?"
    ).run(paidInCrypto != null ? Number(paidInCrypto) : null, now(), depositId);
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(credit, dep.user_id);
    db.prepare(
      'INSERT INTO transactions (id, user_id, type, amount, stripe_intent) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), dep.user_id, 'deposit', credit, dep.payment_id);
    return { credited: true, userId: dep.user_id, amount: credit };
  });
  return apply();
};

// ── GET /api/crypto/currencies  (auth) — pay-in options ───────────────────────
const listCurrencies = async (req, res) => {
  if (MOCK) return res.json({ currencies: POPULAR });
  try {
    if (!_curCache || Date.now() - _curCacheAt > 3600 * 1000) {
      const r = await fetch(`${API}/currencies`, { headers: { 'x-api-key': API_KEY } });
      const d = await r.json();
      _curCache = new Set((d.currencies || []).map((c) => String(c).toLowerCase()));
      _curCacheAt = Date.now();
    }
    const available = POPULAR.filter((c) => _curCache.has(c.code));
    return res.json({ currencies: available.length ? available : POPULAR });
  } catch (e) {
    return res.json({ currencies: POPULAR });
  }
};

// ── POST /api/crypto/deposit  (auth) ──────────────────────────────────────────
const createDeposit = async (req, res) => {
  const userId = req.userId;
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < MIN_DEPOSIT) {
    return res.status(400).json({ error: `Dépôt minimum : ${MIN_DEPOSIT} USDT.` });
  }

  // Pay-in currency chosen by the player (defaults to USDT TRC-20). Restricted
  // to our curated list so arbitrary values can't be injected.
  const payCurrency = (req.body.payCurrency || PAY_CURRENCY).toString().toLowerCase().trim();
  if (!POPULAR_CODES.has(payCurrency)) {
    return res.status(400).json({ error: 'Crypto non supportée.' });
  }

  const id = uuidv4();

  if (MOCK) {
    const address = 'TMock' + crypto.randomBytes(15).toString('hex').slice(0, 29);
    db.prepare(
      "INSERT INTO crypto_deposits (id, user_id, amount, currency, address, payment_id, status) VALUES (?,?,?,?,?,?, 'waiting')"
    ).run(id, userId, amount, payCurrency, address, 'mock_' + id);
    return res.json({
      depositId: id, address, amount, payAmount: amount,
      payCurrency, network: networkOf(payCurrency), status: 'waiting', mock: true,
    });
  }

  try {
    const r = await fetch(`${API}/payment`, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: 'usd',          // account unit ≈ USDT
        pay_currency: payCurrency,
        order_id: id,
        ipn_callback_url: (process.env.PUBLIC_API_URL || '') + '/api/crypto/ipn',
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('[Crypto] deposit provider error', data);
      return res.status(502).json({ error: data.message || 'Erreur du prestataire de paiement.' });
    }
    db.prepare(
      "INSERT INTO crypto_deposits (id, user_id, amount, currency, address, payment_id, status) VALUES (?,?,?,?,?,?,?)"
    ).run(id, userId, amount, payCurrency, data.pay_address, String(data.payment_id), 'waiting');
    return res.json({
      depositId: id, address: data.pay_address, amount,
      payAmount: data.pay_amount, payCurrency,
      network: data.network ? networkOf(payCurrency) : networkOf(payCurrency),
      status: 'waiting',
    });
  } catch (e) {
    console.error('[Crypto] deposit error', e.message);
    return res.status(502).json({ error: 'Impossible de créer le dépôt.' });
  }
};

// ── GET /api/crypto/deposit/:id  (auth) — poll status ─────────────────────────
const getDeposit = (req, res) => {
  const dep = db.prepare('SELECT * FROM crypto_deposits WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!dep) return res.status(404).json({ error: 'Dépôt introuvable.' });
  return res.json({ depositId: dep.id, status: dep.status, amount: dep.amount, received: dep.received, address: dep.address });
};

// ── POST /api/crypto/ipn  (public, HMAC-verified) ─────────────────────────────
// NOWPayments signs the JSON body (keys sorted) with HMAC-SHA512(IPN_SECRET).
const sortDeep = (obj) => {
  if (Array.isArray(obj)) return obj.map(sortDeep);
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = sortDeep(obj[k]); return acc; }, {});
  }
  return obj;
};

const handleIpn = (req, res) => {
  if (MOCK) return res.status(404).json({ error: 'Not found' });
  try {
    const sig = req.headers['x-nowpayments-sig'];
    const expected = crypto.createHmac('sha512', IPN_SECRET)
      .update(JSON.stringify(sortDeep(req.body)))
      .digest('hex');
    if (!sig || sig !== expected) {
      console.warn('[Crypto] IPN bad signature');
      return res.status(400).json({ error: 'bad signature' });
    }
    const { order_id, payment_status, actually_paid, pay_amount } = req.body;
    // Finished/confirmed → credit (idempotent). Failed/expired → mark failed.
    if (['finished', 'confirmed'].includes(payment_status)) {
      creditDeposit(order_id, actually_paid || pay_amount);
    } else if (['failed', 'expired', 'refunded'].includes(payment_status)) {
      db.prepare("UPDATE crypto_deposits SET status='failed', updated_at=? WHERE id=? AND status!='finished'")
        .run(now(), order_id);
    } else {
      db.prepare("UPDATE crypto_deposits SET status='confirming', updated_at=? WHERE id=? AND status='waiting'")
        .run(now(), order_id);
    }
    return res.json({ received: true });
  } catch (e) {
    console.error('[Crypto] IPN error', e.message);
    return res.status(400).json({ error: 'ipn error' });
  }
};

// ── POST /api/crypto/_mock/confirm  (dev only) — simulate a paid deposit ──────
const mockConfirm = (req, res) => {
  const dep = db.prepare('SELECT * FROM crypto_deposits WHERE id = ? AND user_id = ?').get(req.body.depositId, req.userId);
  if (!dep) return res.status(404).json({ error: 'Dépôt introuvable.' });
  const result = creditDeposit(dep.id, dep.amount);
  const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.userId);
  return res.json({ status: 'finished', credited: result.credited, balance: user.balance });
};

// ── POST /api/crypto/withdraw  (auth) ─────────────────────────────────────────
const createWithdrawal = async (req, res) => {
  const userId = req.userId;
  const amount = Number(req.body.amount);
  const address = (req.body.address || '').toString().trim();

  if (!Number.isFinite(amount) || amount < MIN_WITHDRAW) {
    return res.status(400).json({ error: `Retrait minimum : ${MIN_WITHDRAW} USDT.` });
  }
  if (!TRC20_RE.test(address)) {
    return res.status(400).json({ error: 'Adresse USDT TRC-20 invalide.' });
  }

  const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Compte introuvable.' });
  if (user.balance < amount) return res.status(400).json({ error: 'Solde insuffisant.' });

  const id = uuidv4();
  const needsReview = amount > MAX_AUTO_WITHDRAW;
  const initialStatus = needsReview ? 'pending_review' : 'processing';

  // Atomic: debit balance + record the withdrawal request up front so the funds
  // can't be double-spent while the payout is in flight.
  const debit = db.transaction(() => {
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, userId);
    db.prepare('INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), userId, 'withdrawal', -amount);
    db.prepare("INSERT INTO crypto_withdrawals (id, user_id, amount, address, status) VALUES (?,?,?,?,?)")
      .run(id, userId, amount, address, initialStatus);
  });
  debit();

  const balanceAfter = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId).balance;

  if (needsReview) {
    return res.json({
      withdrawalId: id, status: 'pending_review', amount, address, balance: balanceAfter,
      message: `Retrait de ${amount} USDT en attente de validation manuelle.`,
    });
  }

  if (MOCK) {
    const txid = 'mock_tx_' + crypto.randomBytes(16).toString('hex');
    db.prepare("UPDATE crypto_withdrawals SET status='completed', txid=?, updated_at=? WHERE id=?")
      .run(txid, now(), id);
    return res.json({
      withdrawalId: id, status: 'completed', txid, amount, address, balance: balanceAfter,
      message: `Retrait de ${amount} USDT envoyé (mock).`, mock: true,
    });
  }

  // REAL payout. NOWPayments payouts require a payout API key (+ 2FA-issued JWT).
  // On any failure we refund the balance so funds are never lost.
  try {
    if (!PAYOUT_KEY) throw new Error('payout key missing');
    const r = await fetch(`${API}/payout`, {
      method: 'POST',
      headers: { 'x-api-key': PAYOUT_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ withdrawals: [{ address, currency: PAY_CURRENCY, amount }] }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'payout failed');
    const payoutId = String(data.id || (data.withdrawals && data.withdrawals[0] && data.withdrawals[0].id) || '');
    db.prepare("UPDATE crypto_withdrawals SET status='processing', payout_id=?, updated_at=? WHERE id=?")
      .run(payoutId, now(), id);
    return res.json({
      withdrawalId: id, status: 'processing', payoutId, amount, address, balance: balanceAfter,
      message: `Retrait de ${amount} USDT en cours d'envoi.`,
    });
  } catch (e) {
    console.error('[Crypto] payout error — refunding', e.message);
    const refund = db.transaction(() => {
      db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, userId);
      db.prepare('INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)')
        .run(uuidv4(), userId, 'withdrawal_refund', amount);
      db.prepare("UPDATE crypto_withdrawals SET status='failed', updated_at=? WHERE id=?").run(now(), id);
    });
    refund();
    const bal = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId).balance;
    return res.status(502).json({ error: "Échec de l'envoi, montant recrédité.", balance: bal });
  }
};

module.exports = {
  createDeposit, getDeposit, handleIpn, mockConfirm, createWithdrawal, listCurrencies, MOCK,
};
