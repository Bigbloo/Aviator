/**
 * auth.js
 * JWT session auth. A token is minted at create/register/login and encodes the
 * userId. All money/game endpoints derive the acting user from the *verified*
 * token — never from the request body — so knowing someone's userId is no
 * longer enough to act on their account.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '30d';

// Fail closed: refuse to run without a secret rather than signing with a
// guessable default (which would defeat the whole point).
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error('[FATAL] JWT_SECRET is missing or too short. Set it before booting.');
  process.exit(1);
}

const signToken = (userId) => jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });

/**
 * Express middleware: requires a valid Bearer token. On success sets
 * req.userId from the token's subject. On failure responds 401.
 */
const requireAuth = (req, res, next) => {
  const header = req.headers['authorization'] || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  try {
    const payload = jwt.verify(match[1], JWT_SECRET);
    req.userId = payload.sub;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
};

/**
 * Optional auth: if a valid Bearer token is present, sets req.userId; otherwise
 * leaves it undefined and continues (no 401). Used by /register so an anon
 * session can attach credentials to *its own* account, proven by the token —
 * never by an arbitrary userId in the body.
 */
const optionalAuth = (req, res, next) => {
  const header = req.headers['authorization'] || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) {
    try {
      req.userId = jwt.verify(match[1], JWT_SECRET).sub;
    } catch (e) {
      /* ignore invalid token — treated as anonymous */
    }
  }
  return next();
};

/**
 * Admin gate for the withdrawal-review console. Requires the x-admin-token
 * header to match ADMIN_TOKEN. Fails closed: if ADMIN_TOKEN isn't configured,
 * the admin API is disabled entirely (503) rather than open.
 */
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const requireAdmin = (req, res, next) => {
  if (!ADMIN_TOKEN || ADMIN_TOKEN.length < 12) {
    return res.status(503).json({ error: 'Console admin désactivée (ADMIN_TOKEN non configuré).' });
  }
  const token = req.headers['x-admin-token'] || '';
  // Constant-time-ish comparison
  if (token.length !== ADMIN_TOKEN.length) {
    return res.status(401).json({ error: 'Accès admin refusé.' });
  }
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ ADMIN_TOKEN.charCodeAt(i);
  if (diff !== 0) return res.status(401).json({ error: 'Accès admin refusé.' });
  return next();
};

module.exports = { signToken, requireAuth, optionalAuth, requireAdmin };
