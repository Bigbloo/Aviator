/**
 * backup.js
 * Periodic online backups of the SQLite database to <DB_DIR>/backups, with
 * rotation. Protects against corruption/accidental loss; the latest backup can
 * be pulled off-site via the admin endpoint (GET /api/admin/backup).
 */

const fs = require('fs');
const path = require('path');
const db = require('./db/database');

const DB_DIR = process.env.DB_DIR || '/tmp';
const BACKUP_DIR = path.join(DB_DIR, 'backups');
const KEEP = 48; // ~12 days at one every 6h
const INTERVAL_MS = 6 * 60 * 60 * 1000;

const ensureDir = () => {
  try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (e) { /* ignore */ }
};

const listBackups = () => {
  ensureDir();
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('aviator-') && f.endsWith('.db'))
      .sort();
  } catch (e) {
    return [];
  }
};

const runBackup = async () => {
  ensureDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16); // YYYY-MM-DDTHH-MM
  const dest = path.join(BACKUP_DIR, `aviator-${ts}.db`);
  try {
    await db.backup(dest); // better-sqlite3 online backup (safe while running)
    // Rotate: keep only the most recent KEEP files.
    const files = listBackups();
    while (files.length > KEEP) {
      const old = files.shift();
      try { fs.unlinkSync(path.join(BACKUP_DIR, old)); } catch (e) { /* ignore */ }
    }
    console.log(`[Backup] wrote ${path.basename(dest)} (${files.length} kept)`);
    return dest;
  } catch (e) {
    console.error('[Backup] failed:', e.message);
    return null;
  }
};

const latestBackup = () => {
  const files = listBackups();
  return files.length ? path.join(BACKUP_DIR, files[files.length - 1]) : null;
};

const start = () => {
  runBackup();
  setInterval(runBackup, INTERVAL_MS);
  console.log(`[Backup] scheduled every ${INTERVAL_MS / 3600000}h → ${BACKUP_DIR}`);
};

module.exports = { start, runBackup, latestBackup, listBackups, BACKUP_DIR };
