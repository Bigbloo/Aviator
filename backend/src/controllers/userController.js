/**
 * userController.js
 * Handles user creation and balance retrieval.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

/**
 * GET /api/balance/:userId
 * Returns the current balance for a user.
 * Creates the user if they don't exist yet (first visit).
 */
const getBalance = (req, res) => {
  const { userId } = req.params;

  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  if (!user) {
    // Auto-create user on first balance check
    db.prepare('INSERT INTO users (id, balance) VALUES (?, ?)').run(userId, 0);
    user = { id: userId, balance: 0 };
  }

  return res.json({ userId: user.id, balance: user.balance });
};

/**
 * POST /api/user/create
 * Creates a new user with a random UUID and returns it.
 * Called once on first app load if no userId in localStorage.
 */
const createUser = (req, res) => {
  const userId = uuidv4();
  db.prepare('INSERT INTO users (id, balance) VALUES (?, ?)').run(userId, 0);
  return res.json({ userId, balance: 0 });
};

module.exports = { getBalance, createUser };
