/**
 * userController.js
 * Handles user creation, registration (email + password + username) and balance retrieval.
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { signToken } = require('../middleware/auth');

const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_À-ÿ ]+$/;

const publicUser = (u) => ({
  userId: u.id,
  username: u.username || null,
  email: u.email || null,
  firstName: u.first_name || null,
  lastName: u.last_name || null,
  address: u.address || null,
  balance: u.balance,
});

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
    return res.status(401).json({ error: 'Compte introuvable, reconnecte-toi.' });
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
    return res.status(400).json({ error: 'Le pseudo doit faire entre 3 et 20 caractères.' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Pseudo invalide (lettres, chiffres, _).' });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Email invalide.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères.' });
  }
  if (firstName.length < 1 || firstName.length > 80) {
    return res.status(400).json({ error: 'Prénom requis (1-80 caractères).' });
  }
  if (lastName.length < 1 || lastName.length > 80) {
    return res.status(400).json({ error: 'Nom requis (1-80 caractères).' });
  }
  if (address.length < 5 || address.length > 250) {
    return res.status(400).json({ error: 'Adresse requise (5-250 caractères).' });
  }

  const takenName = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (takenName && takenName.id !== userId) {
    return res.status(409).json({ error: 'Ce pseudo est déjà pris.' });
  }
  const takenEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (takenEmail && takenEmail.id !== userId) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  if (userId) {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (existing) {
      db.prepare(
        'UPDATE users SET username = ?, email = ?, password_hash = ?, first_name = ?, last_name = ?, address = ? WHERE id = ?'
      ).run(username, email, passwordHash, firstName, lastName, address, userId);
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      return res.json(authPayload(u));
    }
  }

  const newId = uuidv4();
  db.prepare(
    'INSERT INTO users (id, username, email, password_hash, first_name, last_name, address, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(newId, username, email, passwordHash, firstName, lastName, address, 0);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(newId);
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
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }
  return res.json(authPayload(user));
};

module.exports = { getBalance, createUser, register, login };
