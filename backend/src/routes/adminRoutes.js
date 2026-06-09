/**
 * adminRoutes.js
 * Withdrawal-review console + demo toggle (compliance / owner controls).
 * Mounted at /api/admin, so requireAdmin only gates these routes.
 */

const express = require('express');
const router = express.Router();
const {
  adminListWithdrawals, adminApproveWithdrawal, adminRejectWithdrawal, adminResetBalances,
} = require('../controllers/cryptoController');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// Quick auth probe for the admin UI (200 if the token is valid).
router.get('/ping', (req, res) => res.json({ ok: true }));

router.get('/withdrawals', adminListWithdrawals);
router.post('/withdrawals/:id/approve', adminApproveWithdrawal);
router.post('/withdrawals/:id/reject', adminRejectWithdrawal);
router.post('/reset-balances', adminResetBalances);

module.exports = router;
