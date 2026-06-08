/**
 * userRoutes.js
 * Routes for user management and balance.
 */

const express = require('express');
const router = express.Router();
const { getBalance, createUser, register, login } = require('../controllers/userController');

router.post('/create', createUser);
router.post('/register', register);
router.post('/login', login);
router.get('/balance/:userId', getBalance);

module.exports = router;
