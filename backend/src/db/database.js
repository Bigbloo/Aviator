/**
 * database.js
 * PostgreSQL database initialization using pg-promise.
 * Creates tables for users, rounds, bets, and transactions.
 */

const pgPromise = require('pg-promise');
const cn = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/railway';

const pgp = pgPromise();
const db = pgp(cn);

/**
 * Initialize database tables
 */
const initDB = async () => {
  try {
    // ── Users table ──────────────────────────────────────────────────────────────
    await db.none(`
      CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        balance     REAL NOT NULL DEFAULT 0,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // ── Rounds table ─────────────────────────────────────────────────────────────
    await db.none(`
      CREATE TABLE IF NOT EXISTS rounds (
        id          TEXT PRIMARY KEY,
        crash_point REAL NOT NULL,
        started_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        ended_at    TIMESTAMP,
        status      TEXT NOT NULL DEFAULT 'active'
      )
    `);

    // ── Bets table ───────────────────────────────────────────────────────────────
    await db.none(`
      CREATE TABLE IF NOT EXISTS bets (
        id                  TEXT PRIMARY KEY,
        user_id             TEXT NOT NULL,
        round_id            TEXT NOT NULL,
        bet_amount          REAL NOT NULL,
        cashout_multiplier  REAL,
        payout              REAL,
        status              TEXT NOT NULL DEFAULT 'pending',
        created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
        FOREIGN KEY (user_id)  REFERENCES users(id),
        FOREIGN KEY (round_id) REFERENCES rounds(id)
      )
    `);

    // ── Transactions table ───────────────────────────────────────────────────────
    await db.none(`
      CREATE TABLE IF NOT EXISTS transactions (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL,
        type            TEXT NOT NULL,
        amount          REAL NOT NULL,
        stripe_intent   TEXT,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    console.log('[DB] PostgreSQL tables initialized');
  } catch (err) {
    console.error('[DB] Initialization error:', err.message);
  }
};

// Initialize on module load
initDB();

module.exports = db;
