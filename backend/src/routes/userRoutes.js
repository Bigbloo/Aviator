/**
 * userRoutes.js
 * Routes for user management and balance.
 */

const express = require('express');
const router = express.Router();
const { getBalance, createUser, register, login } = require('../controllers/userController');
const { getLeaderboard } = require('../controllers/leaderboardController');
const { requireAuth, optionalAuth } = require('../middleware/auth');

router.post('/create', createUser);               // public — mints an anon session token
router.post('/register', optionalAuth, register); // optional token → attach to own anon account
router.post('/login', login);                     // public — verifies password, mints token
router.get('/balance', requireAuth, getBalance);  // userId derived from token
router.get('/leaderboard', getLeaderboard);       // public, read-only

module.exports = router;
