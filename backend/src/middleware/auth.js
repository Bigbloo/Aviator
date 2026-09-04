/**
 * auth.js
 * JWT session auth. A token is minted at create/register/login and encodes the
 * userId. All money/game endpoints derive the acting user from the *verified*
 * token — never from the request body — so knowing someone's userId is no
 * longer enough to act on their account.
 */

const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { mailEnabled } = require('../email');

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
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const payload = jwt.verify(match[1], JWT_SECRET);
    req.userId = payload.sub;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
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

// Constant-time-ish check that a presented token equals ADMIN_TOKEN.
const checkAdminToken = (token) => {
  if (!ADMIN_TOKEN || ADMIN_TOKEN.length < 12) return false;
  token = (token || '').toString();
  if (token.length !== ADMIN_TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ ADMIN_TOKEN.charCodeAt(i);
  return diff === 0;
};

const requireAdmin = (req, res, next) => {
  if (!ADMIN_TOKEN || ADMIN_TOKEN.length < 12) {
    return res.status(503).json({ error: 'Admin console disabled (ADMIN_TOKEN not configured).' });
  }
  if (!checkAdminToken(req.headers['x-admin-token'])) {
    return res.status(401).json({ error: 'Admin access denied.' });
  }
  return next();
};

/**
 * A request is in DEMO only when it carries a valid admin token in the
 * x-demo-token header. This makes demo an ADMIN-ONLY, per-request opt-in:
 * regular players never send it, so they always use the real money layer.
 */
const isDemoRequest = (req) => checkAdminToken(req.headers['x-demo-token']);

/**
 * Money endpoints require a confirmed email address. It ties the account to a
 * mailbox its owner controls, so a stolen session cannot cash out to an
 * attacker's address, and it stops one person farming the welcome bonus across
 * throwaway signups.
 *
 * Gated on mailEnabled, and that is not a convenience: with no SMTP configured
 * the verification mail is only written to the log, so nobody *can* verify.
 * Enforcing then would lock every player out of deposits and withdrawals at
 * once. The gate therefore switches itself on the moment SMTP is configured,
 * and stays off — loudly — until then.
 */
let mailWarningShown = false;
const requireVerifiedEmail = (req, res, next) => {
  if (!mailEnabled) {
    if (!mailWarningShown) {
      mailWarningShown = true;
      console.warn(
        '[Auth] SMTP is not configured, so the verified-email requirement on ' +
          'deposits and withdrawals is INACTIVE. Set SMTP_HOST/SMTP_USER/SMTP_PASS ' +
          'to enforce it.'
      );
    }
    return next();
  }
  // Admin demo requests bypass the money layer entirely; keep them working.
  if (isDemoRequest(req)) return next();

  const user = db
    .prepare('SELECT email, email_verified FROM users WHERE id = ?')
    .get(req.userId);
  if (!user) return res.status(401).json({ error: 'Account not found.' });
  if (!user.email) {
    return res.status(403).json({
      error: 'Add an email address to your account before depositing or withdrawing.',
      code: 'EMAIL_REQUIRED',
    });
  }
  if (!user.email_verified) {
    return res.status(403).json({
      error: 'Confirm your email address before depositing or withdrawing. Check your inbox for the verification link.',
      code: 'EMAIL_UNVERIFIED',
    });
  }
  return next();
};

module.exports = {
  signToken,
  requireAuth,
  optionalAuth,
  requireAdmin,
  requireVerifiedEmail,
  isDemoRequest,
};
