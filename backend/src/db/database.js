/**
 * database.js
 * SQLite database initialization using better-sqlite3.
 * Simple in-process database, persists to file.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Persistent storage: set DB_DIR to a Railway volume mount (e.g. /data) so the
// database survives redeploys. Falls back to /tmp (ephemeral) for local/dev.
const DB_DIR = process.env.DB_DIR || '/tmp';
try {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
} catch (e) {
  console.error('[DB] Could not create DB_DIR', DB_DIR, e.message);
}
const DB_PATH = path.join(DB_DIR, 'aviator.db');

const db = new Database(DB_PATH);

// Enable WAL mode
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    balance REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY,
    crash_point REAL NOT NULL,
    started_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    ended_at INTEGER,
    status TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS bets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    round_id TEXT NOT NULL,
    bet_amount REAL NOT NULL,
    cashout_multiplier REAL,
    payout REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (round_id) REFERENCES rounds(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    stripe_intent TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ── Idempotent migrations (for existing DBs that predate a column) ──
try {
  const cols = db.prepare("PRAGMA table_info(users)").all();
  if (!cols.some((c) => c.name === 'username')) {
    db.exec('ALTER TABLE users ADD COLUMN username TEXT');
    console.log('[DB] Migrated: added users.username');
  }
} catch (e) {
  console.error('[DB] Migration check failed:', e.message);
}

console.log('[DB] SQLite initialized from', DB_PATH);

module.exports = db;
