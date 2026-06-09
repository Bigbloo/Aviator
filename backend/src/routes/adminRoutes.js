/**
 * adminRoutes.js
 * Withdrawal-review console (compliance). Gated by the x-admin-token header.
 */

const express = require('express');
const router = express.Router();
const {
  adminListWithdrawals, adminApproveWithdrawal, adminRejectWithdrawal,
  adminGetConfig, adminSetDemo,
} = require('../controllers/cryptoController');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// Quick auth probe for the admin UI (200 if the token is valid).
router.get('/admin/ping', (req, res) => res.json({ ok: true }));

router.get('/admin/withdrawals', adminListWithdrawals);
router.post('/admin/withdrawals/:id/approve', adminApproveWithdrawal);
router.post('/admin/withdrawals/:id/reject', adminRejectWithdrawal);

// Demo-mode toggle (discreet in-app switch).
router.get('/admin/config', adminGetConfig);
router.post('/admin/demo', adminSetDemo);

module.exports = router;
