/**
 * userController.js
 * Handles user creation, registration (with username) and balance retrieval.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

/**
 * GET /api/balance/:userId
 * Returns the current balance + username for a user.
 * Creates the user if they don't exist yet (first visit).
 */
const getBalance = (req, res) => {
  const { userId } = req.params;

  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  if (!user) {
    // Auto-create user on first balance check
    db.prepare('INSERT INTO users (id, balance) VALUES (?, ?)').run(userId, 0);
    user = { id: userId, username: null, balance: 0 };
  }

  return res.json({ userId: user.id, username: user.username || null, balance: user.balance });
};

/**
 * POST /api/create
 * Creates a new anonymous user with a random UUID and returns it.
 * Called once on first app load if no userId in localStorage.
 */
const createUser = (req, res) => {
  const userId = uuidv4();
  db.prepare('INSERT INTO users (id, balance) VALUES (?, ?)').run(userId, 0);
  return res.json({ userId, username: null, balance: 0 });
};

/**
 * POST /api/register
 * Body: { username, userId? }
 * Creates an account with a username. If userId is provided (existing anon
 * session), it attaches the username to that account instead of creating a
 * new one — so the player keeps their balance.
 */
const register = (req, res) => {
  let { username, userId } = req.body;

  username = (username || '').toString().trim();
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: "Le pseudo doit faire entre 3 et 20 caractères." });
  }
  if (!/^[A-Za-z0-9_À-ÿ ]+$/.test(username)) {
    return res.status(400).json({ error: "Pseudo invalide (lettres, chiffres, _ uniquement)." });
  }

  // Username must be unique
  const taken = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (taken && taken.id !== userId) {
    return res.status(409).json({ error: 'Ce pseudo est déjà pris.' });
  }

  // Attach to existing anon account if provided, else create new
  if (userId) {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (existing) {
      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, userId);
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      return res.json({ userId: u.id, username: u.username, balance: u.balance });
    }
  }

  const newId = uuidv4();
  db.prepare('INSERT INTO users (id, username, balance) VALUES (?, ?, ?)').run(newId, username, 0);
  return res.json({ userId: newId, username, balance: 0 });
};

/**
 * POST /api/login
 * Body: { username }
 * "Logs in" by username (no password — demo mode). Returns the existing account.
 */
const login = (req, res) => {
  const username = (req.body.username || '').toString().trim();
  if (!username) return res.status(400).json({ error: 'Pseudo requis.' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(404).json({ error: 'Aucun compte avec ce pseudo.' });

  return res.json({ userId: user.id, username: user.username, balance: user.balance });
};

module.exports = { getBalance, createUser, register, login };
