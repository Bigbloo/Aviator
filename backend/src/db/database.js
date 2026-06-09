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
    slot INTEGER NOT NULL DEFAULT 1,
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

  -- Crypto (USDT TRC-20) deposits. payment_id is the provider's id and is
  -- UNIQUE so a replayed IPN webhook can never credit a balance twice.
  CREATE TABLE IF NOT EXISTS crypto_deposits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,           -- expected/credited amount (USDT)
    received REAL,                  -- actually paid (USDT), set on confirmation
    currency TEXT NOT NULL DEFAULT 'usdttrc20',
    address TEXT,                   -- pay-in address shown to the user
    payment_id TEXT UNIQUE,         -- provider payment id (idempotency key)
    status TEXT NOT NULL DEFAULT 'waiting', -- waiting | confirming | finished | failed
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Crypto withdrawals (payouts) to a player-provided TRC-20 address.
  CREATE TABLE IF NOT EXISTS crypto_withdrawals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,           -- USDT
    address TEXT NOT NULL,
    txid TEXT,                      -- on-chain tx hash once sent
    payout_id TEXT,                 -- provider payout id
    status TEXT NOT NULL DEFAULT 'processing', -- processing | pending_review | completed | failed
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ── Idempotent migrations (for existing DBs that predate a column) ──
try {
  const cols = db.prepare("PRAGMA table_info(users)").all();
  const has = (n) => cols.some((c) => c.name === n);
  if (!has('username')) {
    db.exec('ALTER TABLE users ADD COLUMN username TEXT');
    console.log('[DB] Migrated: added users.username');
  }
  if (!has('email')) {
    db.exec('ALTER TABLE users ADD COLUMN email TEXT');
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL");
    console.log('[DB] Migrated: added users.email (unique)');
  }
  if (!has('password_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
    console.log('[DB] Migrated: added users.password_hash');
  }
  if (!has('first_name')) {
    db.exec('ALTER TABLE users ADD COLUMN first_name TEXT');
    console.log('[DB] Migrated: added users.first_name');
  }
  if (!has('last_name')) {
    db.exec('ALTER TABLE users ADD COLUMN last_name TEXT');
    console.log('[DB] Migrated: added users.last_name');
  }
  if (!has('address')) {
    db.exec('ALTER TABLE users ADD COLUMN address TEXT');
    console.log('[DB] Migrated: added users.address');
  }
  if (!has('email_verified')) {
    db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
    console.log('[DB] Migrated: added users.email_verified');
  }
} catch (e) {
  console.error('[DB] Migration check failed:', e.message);
}

// Auth tokens for email verification and password reset.
db.exec(`
  CREATE TABLE IF NOT EXISTS auth_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,                 -- 'verify' | 'reset'
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Migration: add bets.slot (double-bet feature) for pre-existing DBs.
try {
  const betCols = db.prepare("PRAGMA table_info(bets)").all();
  if (!betCols.some((c) => c.name === 'slot')) {
    db.exec('ALTER TABLE bets ADD COLUMN slot INTEGER NOT NULL DEFAULT 1');
    console.log('[DB] Migrated: added bets.slot');
  }
} catch (e) {
  console.error('[DB] bets.slot migration check failed:', e.message);
}

// Migration: withdrawal review audit trail (manual approval flow).
try {
  const wCols = db.prepare("PRAGMA table_info(crypto_withdrawals)").all();
  const wHas = (n) => wCols.some((c) => c.name === n);
  if (wCols.length) {
    if (!wHas('note')) {
      db.exec('ALTER TABLE crypto_withdrawals ADD COLUMN note TEXT');
      console.log('[DB] Migrated: added crypto_withdrawals.note');
    }
    if (!wHas('reviewed_at')) {
      db.exec('ALTER TABLE crypto_withdrawals ADD COLUMN reviewed_at INTEGER');
      console.log('[DB] Migrated: added crypto_withdrawals.reviewed_at');
    }
  }
} catch (e) {
  console.error('[DB] crypto_withdrawals migration check failed:', e.message);
}

console.log('[DB] SQLite initialized from', DB_PATH);

module.exports = db;
