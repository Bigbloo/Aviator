/**
 * userRoutes.js
 * Routes for user management and balance.
 */

const express = require('express');
const router = express.Router();
const { getBalance, createUser } = require('../controllers/userController');

router.post('/create', createUser);
router.get('/balance/:userId', getBalance);

module.exports = router;
