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

const { isMock } = require('../config');
const { isDemoRequest } = require('../middleware/auth');
const provider = require('../providers');

// Tunables
const MIN_DEPOSIT = 1;            // USD (Plisio enforces its own per-currency min)
const MIN_WITHDRAW = 10;          // USDT
const MAX_AUTO_WITHDRAW = 1000;   // above this, hold for manual review (anti-abuse/AML)
const PAY_CURRENCY = 'usdttrc20';

// TRC-20 address: base58, starts with 'T', 34 chars total.
const TRC20_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

// Curated list of pay-in currencies offered to the player. The account balance
// stays in USDT; NOWPayments converts whatever they pay into that value.
const POPULAR = [
  { code: 'btc',    name: 'Bitcoin', network: 'Bitcoin' },
  { code: 'sol',    name: 'Solana', network: 'Solana' },
  { code: 'ton',    name: 'Toncoin', network: 'TON' },
  { code: 'bnbbsc', name: 'BNB', network: 'BEP-20 (BSC)' },
  { code: 'ltc',    name: 'Litecoin', network: 'Litecoin' },
  { code: 'xmr',    name: 'Monero', network: 'Monero' },
];
const POPULAR_CODES = new Set(POPULAR.map((c) => c.code));
const networkOf = (code) => (POPULAR.find((c) => c.code === code) || {}).network || code;

const now = () => Math.floor(Date.now() / 1000);

// A "registered" account has credentials (email + password). Anonymous sessions
// don't — they can play but cannot move real money.
const isRegistered = (userId) => {
  const u = db.prepare('SELECT email, password_hash FROM users WHERE id = ?').get(userId);
  return !!(u && u.email && u.password_hash);
};

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
const listCurrencies = (req, res) => {
  // In mock/dev, offer all; otherwise only what the active provider maps.
  const list = isMock() ? POPULAR : POPULAR.filter((c) => provider.supports(c.code));
  return res.json({ currencies: list.length ? list : POPULAR });
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

  // Demo = admin-only per-request (valid x-demo-token) OR local dev (no key).
  const demo = isDemoRequest(req) || isMock();

  if (demo) {
    const address = 'TDemo' + crypto.randomBytes(15).toString('hex').slice(0, 29);
    db.prepare(
      "INSERT INTO crypto_deposits (id, user_id, amount, currency, address, payment_id, status) VALUES (?,?,?,?,?,?, 'waiting')"
    ).run(id, userId, amount, payCurrency, address, 'demo_' + id);
    // Instant credit — no on-chain step in demo.
    creditDeposit(id, amount);
    const bal = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId).balance;
    return res.json({
      depositId: id, address, amount, payAmount: amount,
      payCurrency, network: networkOf(payCurrency), status: 'finished', demo: true, balance: bal,
    });
  }

  // Real deposits require a registered account (no anonymous money movement).
  if (!isRegistered(userId)) {
    return res.status(403).json({ error: 'Crée un compte pour déposer.', needAccount: true });
  }

  try {
    const out = await provider.createDeposit({ amount, genericCode: payCurrency, orderId: id });
    db.prepare(
      "INSERT INTO crypto_deposits (id, user_id, amount, currency, address, payment_id, status) VALUES (?,?,?,?,?,?,?)"
    ).run(id, userId, amount, payCurrency, out.address, out.paymentId, 'waiting');
    return res.json({
      depositId: id, address: out.address, amount,
      payAmount: out.payAmount, payCurrency,
      network: networkOf(payCurrency),
      invoiceUrl: out.invoiceUrl || null,
      status: 'waiting',
    });
  } catch (e) {
    console.error(`[Crypto] deposit error (${provider.name}):`, e.message);
    return res.status(502).json({ error: e.message || 'Impossible de créer le dépôt.' });
  }
};

// ── GET /api/crypto/deposit/:id  (auth) — poll status ─────────────────────────
const getDeposit = (req, res) => {
  const dep = db.prepare('SELECT * FROM crypto_deposits WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!dep) return res.status(404).json({ error: 'Dépôt introuvable.' });
  return res.json({ depositId: dep.id, status: dep.status, amount: dep.amount, received: dep.received, address: dep.address });
};

// ── POST /api/crypto/ipn  (public) — provider callback (verified per provider) ─
const handleIpn = async (req, res) => {
  if (isMock()) return res.status(404).json({ error: 'Not found' });
  try {
    const result = await provider.parseCallback(req);
    if (!result || !result.orderId) {
      console.warn(`[Callback:${provider.name}] rejected (invalid signature/status)`);
      return res.status(400).json({ error: 'invalid callback' });
    }
    console.log(`[Callback:${provider.name}] order=${result.orderId} paid=${result.paid} failed=${result.failed}`);
    if (result.paid) {
      const r = creditDeposit(result.orderId, null);
      if (r.credited) console.log(`[Callback] credited ${r.amount} USDT to user ${r.userId}`);
    } else if (result.failed) {
      db.prepare("UPDATE crypto_deposits SET status='failed', updated_at=? WHERE id=? AND status!='finished'")
        .run(now(), result.orderId);
    } else {
      db.prepare("UPDATE crypto_deposits SET status='confirming', updated_at=? WHERE id=? AND status='waiting'")
        .run(now(), result.orderId);
    }
    return res.json({ received: true });
  } catch (e) {
    console.error('[Crypto] callback error', e.message);
    return res.status(400).json({ error: 'callback error' });
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
// EVERY withdrawal is held for manual compliance review. The balance is debited
// immediately (so the funds can't be re-bet while pending); an admin then
// approves (sends on-chain) or rejects (refunds) it from the admin console.
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

  // Admin demo (or local dev): instant simulated payout, no review queue.
  const demo = isDemoRequest(req) || isMock();

  // Real withdrawals require a registered account.
  if (!demo && !isRegistered(userId)) {
    return res.status(403).json({ error: 'Crée un compte pour retirer.', needAccount: true });
  }

  const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Compte introuvable.' });
  if (user.balance < amount) return res.status(400).json({ error: 'Solde insuffisant.' });

  const id = uuidv4();

  const debit = db.transaction(() => {
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, userId);
    db.prepare('INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), userId, 'withdrawal', -amount);
    db.prepare("INSERT INTO crypto_withdrawals (id, user_id, amount, address, status) VALUES (?,?,?,?,?)")
      .run(id, userId, amount, address, demo ? 'completed' : 'pending_review');
  });
  debit();

  const balanceAfter = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId).balance;

  if (demo) {
    const txid = 'demo_tx_' + crypto.randomBytes(12).toString('hex');
    db.prepare("UPDATE crypto_withdrawals SET txid=?, updated_at=? WHERE id=?").run(txid, now(), id);
    return res.json({
      withdrawalId: id, status: 'completed', txid, amount, address, balance: balanceAfter,
      demo: true, message: `Retrait de ${amount} USDT envoyé (démo).`,
    });
  }

  return res.json({
    withdrawalId: id, status: 'pending_review', amount, address, balance: balanceAfter,
    message: `Retrait de ${amount} USDT enregistré — en attente de validation (conformité).`,
  });
};

// ── Shared payout executor (used by the legacy auto-approve) ───────────────────
// Withdrawals are paid manually now (admin "mark-paid" with the on-chain txid),
// so automated payout isn't wired to a provider. Mock instant-completes; real
// returns an error so the admin uses the manual flow.
const executePayout = async () => {
  if (isMock()) {
    const txid = 'mock_tx_' + crypto.randomBytes(16).toString('hex');
    return { ok: true, status: 'completed', txid };
  }
  return { ok: false, error: 'paiement automatique indisponible — utilise « Marquer payé »' };
};

// ── ADMIN: GET /api/admin/withdrawals?status=pending_review ───────────────────
// Lists withdrawals with the player's KYC info for compliance review.
const adminListWithdrawals = (req, res) => {
  const status = (req.query.status || '').toString();
  const params = [];
  let where = '';
  if (status) { where = 'WHERE w.status = ?'; params.push(status); }
  const rows = db.prepare(
    `SELECT w.id, w.amount, w.address, w.status, w.txid, w.payout_id, w.note,
            w.created_at, w.reviewed_at,
            u.id AS user_id, u.username, u.email, u.first_name, u.last_name, u.address AS user_address
     FROM crypto_withdrawals w JOIN users u ON u.id = w.user_id
     ${where}
     ORDER BY (w.status = 'pending_review') DESC, w.created_at DESC
     LIMIT 200`
  ).all(...params);
  const pending = db.prepare("SELECT COUNT(*) AS n FROM crypto_withdrawals WHERE status='pending_review'").get().n;
  return res.json({ withdrawals: rows, pendingCount: pending });
};

// ── ADMIN: POST /api/admin/withdrawals/:id/approve ────────────────────────────
const adminApproveWithdrawal = async (req, res) => {
  const w = db.prepare('SELECT * FROM crypto_withdrawals WHERE id = ?').get(req.params.id);
  if (!w) return res.status(404).json({ error: 'Retrait introuvable.' });
  if (w.status !== 'pending_review') {
    return res.status(409).json({ error: `Déjà traité (statut: ${w.status}).` });
  }
  const result = await executePayout(w);
  if (!result.ok) {
    return res.status(502).json({ error: `Échec de l'envoi : ${result.error}. Le retrait reste en attente.` });
  }
  const note = (req.body && req.body.note ? String(req.body.note) : '').slice(0, 500);
  db.prepare(
    "UPDATE crypto_withdrawals SET status=?, txid=?, payout_id=?, note=?, reviewed_at=?, updated_at=? WHERE id=?"
  ).run(result.status, result.txid || null, result.payoutId || null, note || null, now(), now(), w.id);
  return res.json({ id: w.id, status: result.status, txid: result.txid || null });
};

// ── ADMIN: POST /api/admin/withdrawals/:id/mark-paid ──────────────────────────
// Manual payout: the admin sent the funds from their own wallet and records the
// on-chain tx hash. Does NOT touch the balance (already debited at request).
const adminMarkPaidWithdrawal = (req, res) => {
  const w = db.prepare('SELECT * FROM crypto_withdrawals WHERE id = ?').get(req.params.id);
  if (!w) return res.status(404).json({ error: 'Retrait introuvable.' });
  if (!['pending_review', 'processing', 'failed'].includes(w.status)) {
    return res.status(409).json({ error: `Déjà traité (statut: ${w.status}).` });
  }
  const txid = (req.body && req.body.txid ? String(req.body.txid) : '').trim();
  if (txid.length < 6) {
    return res.status(400).json({ error: 'Renseigne le hash de transaction (txid).' });
  }
  const note = (req.body && req.body.note ? String(req.body.note) : 'Paiement manuel').slice(0, 500);
  db.prepare("UPDATE crypto_withdrawals SET status='completed', txid=?, note=?, reviewed_at=?, updated_at=? WHERE id=?")
    .run(txid, note, now(), now(), w.id);
  return res.json({ id: w.id, status: 'completed', txid });
};

// ── ADMIN: POST /api/admin/withdrawals/:id/reject ─────────────────────────────
// Refunds the held balance and marks the withdrawal rejected.
const adminRejectWithdrawal = (req, res) => {
  const w = db.prepare('SELECT * FROM crypto_withdrawals WHERE id = ?').get(req.params.id);
  if (!w) return res.status(404).json({ error: 'Retrait introuvable.' });
  if (w.status !== 'pending_review') {
    return res.status(409).json({ error: `Déjà traité (statut: ${w.status}).` });
  }
  const note = (req.body && req.body.note ? String(req.body.note) : '').slice(0, 500);
  const refund = db.transaction(() => {
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(w.amount, w.user_id);
    db.prepare('INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), w.user_id, 'withdrawal_refund', w.amount);
    db.prepare("UPDATE crypto_withdrawals SET status='rejected', note=?, reviewed_at=?, updated_at=? WHERE id=?")
      .run(note || null, now(), now(), w.id);
  });
  refund();
  return res.json({ id: w.id, status: 'rejected', refunded: w.amount });
};

// ── ADMIN: reset all balances to 0 (test/maintenance) ────────────────────────
const adminResetBalances = (req, res) => {
  if (!req.body || req.body.confirm !== true) {
    return res.status(400).json({ error: 'Confirmation requise ({ "confirm": true }).' });
  }
  const info = db.prepare('UPDATE users SET balance = 0').run();
  console.log(`[Admin] Reset balances of ${info.changes} users to 0`);
  return res.json({ reset: info.changes });
};

module.exports = {
  createDeposit, getDeposit, handleIpn, mockConfirm, createWithdrawal, listCurrencies,
  adminListWithdrawals, adminApproveWithdrawal, adminRejectWithdrawal, adminMarkPaidWithdrawal,
  adminResetBalances,
};
