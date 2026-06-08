/**
 * adminRoutes.js
 * Withdrawal-review console (compliance). Gated by the x-admin-token header.
 */

const express = require('express');
const router = express.Router();
const {
  adminListWithdrawals, adminApproveWithdrawal, adminRejectWithdrawal,
} = require('../controllers/cryptoController');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// Quick auth probe for the admin UI (200 if the token is valid).
router.get('/admin/ping', (req, res) => res.json({ ok: true }));

router.get('/admin/withdrawals', adminListWithdrawals);
router.post('/admin/withdrawals/:id/approve', adminApproveWithdrawal);
router.post('/admin/withdrawals/:id/reject', adminRejectWithdrawal);

module.exports = router;
