/**
 * userAdminController.js
 * Admin-only: list registered players (contact details) and export them as CSV.
 * Only accounts with a real email/password (registered, not anonymous) are
 * returned — anonymous sessions have no contact info to show.
 */

const db = require('../db/database');

const REGISTERED_WHERE = "WHERE email IS NOT NULL AND password_hash IS NOT NULL";

const listRegisteredUsers = () =>
  db.prepare(
    `SELECT id, username, email, first_name, last_name, address, balance,
            email_verified, wager_remaining, created_at
     FROM users
     ${REGISTERED_WHERE}
     ORDER BY created_at DESC`
  ).all();

// ── GET /api/admin/users  (admin) — JSON list for the admin console ──────────
const adminListUsers = (req, res) => {
  const rows = listRegisteredUsers();
  return res.json({
    total: rows.length,
    users: rows.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      address: u.address,
      balance: u.balance,
      emailVerified: !!u.email_verified,
      wagerRemaining: u.wager_remaining || 0,
      createdAt: u.created_at,
    })),
  });
};

// Minimal CSV escaping: wrap in quotes, double up any embedded quotes.
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// ── GET /api/admin/users/export.csv  (admin) — downloadable CSV ──────────────
const adminExportUsersCsv = (req, res) => {
  const rows = listRegisteredUsers();
  const header = ['username', 'email', 'first_name', 'last_name', 'address', 'balance', 'email_verified', 'created_at'];
  const lines = [header.join(',')];
  for (const u of rows) {
    lines.push([
      csvCell(u.username),
      csvCell(u.email),
      csvCell(u.first_name),
      csvCell(u.last_name),
      csvCell(u.address),
      csvCell(u.balance),
      csvCell(u.email_verified ? 'yes' : 'no'),
      csvCell(new Date(u.created_at * 1000).toISOString()),
    ].join(','));
  }
  const csv = lines.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="aviator-players-${Date.now()}.csv"`);
  return res.send(csv);
};

module.exports = { adminListUsers, adminExportUsersCsv };
