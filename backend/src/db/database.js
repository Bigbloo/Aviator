/**
 * database.js
 * SQLite database initialization using better-sqlite3.
 * Creates tables for users, rounds, bets, and transactions.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../aviator.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// ── Users table ──────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    balance     REAL NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )
`);

// ── Rounds table ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS rounds (
    id          TEXT PRIMARY KEY,
    crash_point REAL NOT NULL,
    started_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    ended_at    INTEGER,
    status      TEXT NOT NULL DEFAULT 'active'  -- 'active' | 'crashed'
  )
`);

// ── Bets table ───────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS bets (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL,
    round_id            TEXT NOT NULL,
    bet_amount          REAL NOT NULL,
    cashout_multiplier  REAL,
    payout              REAL,
    status              TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'won' | 'lost'
    created_at          INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id)  REFERENCES users(id),
    FOREIGN KEY (round_id) REFERENCES rounds(id)
  )
`);

// ── Transactions table ───────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    type            TEXT NOT NULL,   -- 'deposit' | 'withdrawal' | 'bet' | 'win'
    amount          REAL NOT NULL,
    stripe_intent   TEXT,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

module.exports = db;
