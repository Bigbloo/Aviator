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
const backup = require('../backup');

router.use(requireAdmin);

// Quick auth probe for the admin UI (200 if the token is valid).
router.get('/ping', (req, res) => res.json({ ok: true }));

router.get('/withdrawals', adminListWithdrawals);
router.post('/withdrawals/:id/approve', adminApproveWithdrawal);
router.post('/withdrawals/:id/reject', adminRejectWithdrawal);
router.post('/reset-balances', adminResetBalances);

// DB backups: trigger one, list, or download the latest.
router.post('/backup', async (req, res) => {
  const f = await backup.runBackup();
  return f ? res.json({ ok: true, file: require('path').basename(f) }) : res.status(500).json({ error: 'backup failed' });
});
router.get('/backups', (req, res) => res.json({ backups: backup.listBackups() }));
router.get('/backup', (req, res) => {
  const f = backup.latestBackup();
  if (!f) return res.status(404).json({ error: 'Aucun backup disponible.' });
  return res.download(f);
});

module.exports = router;
