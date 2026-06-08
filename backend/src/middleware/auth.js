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

module.exports = { signToken, requireAuth, optionalAuth };
