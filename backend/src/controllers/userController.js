/**
 * userController.js
 * Handles user creation, registration (email + password + username) and balance retrieval.
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { signToken } = require('../middleware/auth');
const { send } = require('../email');

const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_À-ÿ ]+$/;
const WEB = process.env.PUBLIC_WEB_URL || 'https://frontend-wine-six-11.vercel.app';
const TOKEN_TTL = { verify: 3 * 86400, reset: 3600 }; // seconds
const nowS = () => Math.floor(Date.now() / 1000);

const publicUser = (u) => ({
  userId: u.id,
  username: u.username || null,
  email: u.email || null,
  firstName: u.first_name || null,
  lastName: u.last_name || null,
  address: u.address || null,
  emailVerified: !!u.email_verified,
  balance: u.balance,
});

// ── Email token helpers ───────────────────────────────────────────────────────
const issueToken = (userId, type) => {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO auth_tokens (token, user_id, type, expires_at) VALUES (?,?,?,?)')
    .run(token, userId, type, nowS() + TOKEN_TTL[type]);
  return token;
};

const sendVerificationEmail = async (user) => {
  if (!user || !user.email) return;
  const token = issueToken(user.id, 'verify');
  const link = `${WEB}/verify-email?token=${token}`;
  await send(
    user.email,
    'Confirm your email address — Aviator',
    `<p>Welcome ${user.username || ''}!</p>
     <p>Confirm your email address by clicking this link:</p>
     <p><a href="${link}">${link}</a></p>
     <p style="color:#888;font-size:12px">This link expires in 3 days.</p>`
  );
};

// Auth responses additionally carry a fresh session token.
const authPayload = (u) => ({ ...publicUser(u), token: signToken(u.id) });

/**
 * GET /api/balance  (auth required)
 * Returns the current balance + profile for the authenticated user.
 * The userId comes from the verified JWT, never from the URL.
 */
const getBalance = (req, res) => {
  const userId = req.userId;
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    // Token references a user that no longer exists (e.g. wiped DB).
    return res.status(401).json({ error: 'Account not found, please sign in again.' });
  }
  return res.json(publicUser(user));
};

/**
 * POST /api/create
 * Creates a new anonymous user with a random UUID and mints a session token.
 */
const createUser = (req, res) => {
  const userId = uuidv4();
  db.prepare('INSERT INTO users (id, balance) VALUES (?, ?)').run(userId, 0);
  return res.json({ userId, username: null, email: null, balance: 0, token: signToken(userId) });
};

/**
 * POST /api/register
 * Body: { username, email, password, userId? }
 * Real signup with bcrypt-hashed password. If userId is provided (anon
 * session), the credentials are attached to that account so the balance is
 * preserved. Otherwise a new account is created.
 */
const register = async (req, res) => {
  let { username, email, password, firstName, lastName, address } = req.body || {};
  // The anon account to upgrade is proven by the optional token (req.userId),
  // NOT taken from the body — otherwise anyone could hijack a known userId.
  const userId = req.userId || null;
  username  = (username  || '').toString().trim();
  email     = (email     || '').toString().trim().toLowerCase();
  password  = (password  || '').toString();
  firstName = (firstName || '').toString().trim();
  lastName  = (lastName  || '').toString().trim();
  address   = (address   || '').toString().trim();

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: 'Username must be between 3 and 20 characters.' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Invalid username (letters, digits, _).' });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Invalid email.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (firstName.length < 1 || firstName.length > 80) {
    return res.status(400).json({ error: 'First name required (1-80 characters).' });
  }
  if (lastName.length < 1 || lastName.length > 80) {
    return res.status(400).json({ error: 'Last name required (1-80 characters).' });
  }
  if (address.length < 5 || address.length > 250) {
    return res.status(400).json({ error: 'Address required (5-250 characters).' });
  }

  const takenName = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (takenName && takenName.id !== userId) {
    return res.status(409).json({ error: 'This username is already taken.' });
  }
  const takenEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (takenEmail && takenEmail.id !== userId) {
    return res.status(409).json({ error: 'This email is already in use.' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  if (userId) {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (existing) {
      db.prepare(
        'UPDATE users SET username = ?, email = ?, password_hash = ?, first_name = ?, last_name = ?, address = ? WHERE id = ?'
      ).run(username, email, passwordHash, firstName, lastName, address, userId);
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      sendVerificationEmail(u).catch((e) => console.error('[Mail] verify send:', e.message));
      return res.json(authPayload(u));
    }
  }

  const newId = uuidv4();
  db.prepare(
    'INSERT INTO users (id, username, email, password_hash, first_name, last_name, address, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(newId, username, email, passwordHash, firstName, lastName, address, 0);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(newId);
  sendVerificationEmail(u).catch((e) => console.error('[Mail] verify send:', e.message));
  return res.json(authPayload(u));
};

/**
 * POST /api/login
 * Body: { identifier, password }   // identifier = email OR username
 * Verifies bcrypt hash. Returns the account on success.
 */
const login = async (req, res) => {
  let { identifier, password, username, email } = req.body || {};
  identifier = (identifier || email || username || '').toString().trim().toLowerCase();
  password   = (password || '').toString();

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
  }

  const user =
    db.prepare('SELECT * FROM users WHERE email = ?').get(identifier) ||
    db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get(identifier);

  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  return res.json(authPayload(user));
};

// ── GET /api/verify-email?token=… ─────────────────────────────────────────────
const verifyEmail = (req, res) => {
  const token = (req.query.token || '').toString();
  const row = db.prepare("SELECT * FROM auth_tokens WHERE token = ? AND type = 'verify' AND used = 0").get(token);
  if (!row || row.expires_at < nowS()) {
    return res.status(400).json({ error: 'Invalid or expired link.' });
  }
  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(row.user_id);
  db.prepare('UPDATE auth_tokens SET used = 1 WHERE token = ?').run(token);
  return res.json({ ok: true });
};

// ── POST /api/resend-verification  (auth) ─────────────────────────────────────
const resendVerification = async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user || !user.email) return res.status(400).json({ error: 'No email address on this account.' });
  if (user.email_verified) return res.json({ ok: true, alreadyVerified: true });
  await sendVerificationEmail(user).catch((e) => console.error('[Mail] resend:', e.message));
  return res.json({ ok: true });
};

// ── POST /api/forgot-password  { email } ──────────────────────────────────────
const forgotPassword = async (req, res) => {
  const email = (req.body && req.body.email ? req.body.email : '').toString().trim().toLowerCase();
  const user = email ? db.prepare('SELECT * FROM users WHERE email = ?').get(email) : null;
  if (user) {
    const token = issueToken(user.id, 'reset');
    const link = `${WEB}/reset-password?token=${token}`;
    await send(
      user.email,
      'Reset your password — Aviator',
      `<p>You requested to reset your password.</p>
       <p><a href="${link}">${link}</a></p>
       <p style="color:#888;font-size:12px">This link expires in 1 hour. If you did not request this, ignore this email.</p>`
    ).catch((e) => console.error('[Mail] reset:', e.message));
  }
  // Always succeed to avoid revealing whether an email exists.
  return res.json({ ok: true });
};

// ── POST /api/reset-password  { token, password } ─────────────────────────────
const resetPassword = async (req, res) => {
  const token = (req.body && req.body.token ? req.body.token : '').toString();
  const password = (req.body && req.body.password ? req.body.password : '').toString();
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const row = db.prepare("SELECT * FROM auth_tokens WHERE token = ? AND type = 'reset' AND used = 0").get(token);
  if (!row || row.expires_at < nowS()) {
    return res.status(400).json({ error: 'Invalid or expired link.' });
  }
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const apply = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id);
    db.prepare('UPDATE auth_tokens SET used = 1 WHERE token = ?').run(token);
    // Invalidate any other outstanding reset tokens for this user.
    db.prepare("UPDATE auth_tokens SET used = 1 WHERE user_id = ? AND type = 'reset'").run(row.user_id);
  });
  apply();
  return res.json({ ok: true });
};

module.exports = {
  getBalance, createUser, register, login,
  verifyEmail, resendVerification, forgotPassword, resetPassword,
};
