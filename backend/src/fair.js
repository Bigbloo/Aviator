/**
 * fair.js
 * Provably Fair (commit-reveal) for crash rounds.
 *
 * Before a round:  publish  seedHash = SHA256(serverSeed)        (the commit)
 * During the round: crash   = f(serverSeed) — fixed, see below
 * After the crash:  reveal  serverSeed                            (the reveal)
 *
 * Anyone can then check that SHA256(serverSeed) matches the hash shown before
 * the round, and recompute the crash point from the seed.
 *
 * The crash is derived from SHA256(serverSeed + ':aviator'), NOT from the
 * published hash — otherwise the commit itself would leak the outcome.
 */

const crypto = require('crypto');

const HOUSE_EDGE = 0.05;
const CRASH_SALT = ':aviator';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const newServerSeed = () => crypto.randomBytes(32).toString('hex');

const hashSeed = (serverSeed) => sha256(serverSeed);

/**
 * Deterministic crash point from the seed. Same distribution as before:
 * r uniform in [0,1) from 52 bits; 5% instant crash, else 0.99/(1-r).
 */
const crashFromSeed = (serverSeed) => {
  const h = sha256(serverSeed + CRASH_SALT);
  const r = parseInt(h.slice(0, 13), 16) / Math.pow(2, 52); // 52 bits → [0,1)
  if (r < HOUSE_EDGE) return 1.0;
  return Math.round(Math.max(1.0, 0.99 / (1 - r)) * 100) / 100;
};

module.exports = { newServerSeed, hashSeed, crashFromSeed, HOUSE_EDGE, CRASH_SALT };
