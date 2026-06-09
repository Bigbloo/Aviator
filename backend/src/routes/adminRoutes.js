/**
 * adminRoutes.js
 * Withdrawal-review console + demo toggle (compliance / owner controls).
 * Mounted at /api/admin, so requireAdmin only gates these routes.
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
router.get('/ping', (req, res) => res.json({ ok: true }));

router.get('/withdrawals', adminListWithdrawals);
router.post('/withdrawals/:id/approve', adminApproveWithdrawal);
router.post('/withdrawals/:id/reject', adminRejectWithdrawal);

// Demo-mode toggle (discreet in-app switch).
router.get('/config', adminGetConfig);
router.post('/demo', adminSetDemo);

module.exports = router;
