/**
 * tiktok.js
 * Server-side TikTok Events API (EAPI) sender.
 * Fire-and-forget: it never throws and never blocks the request — analytics
 * must not be able to break a signup or a deposit. No-op unless both
 * TIKTOK_EVENTS_TOKEN (secret, set in the host env) and a pixel id are present.
 *
 * Docs: https://business-api.tiktok.com/portal/docs (Events API v1.3)
 */

const crypto = require('crypto');

const ENDPOINT = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
const TOKEN = process.env.TIKTOK_EVENTS_TOKEN || '';
// Pixel id is public (it's in the frontend), so a default is fine.
const PIXEL_ID = process.env.TIKTOK_PIXEL_ID || 'D8LKJLRC77U580P27HUG';
const SITE_URL = process.env.WEB_URL || 'https://flomingo.sbs';

// SHA-256 of a normalized value (trim + lowercase), as TikTok requires for PII.
const hash = (v) => {
  if (!v) return undefined;
  return crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');
};

/**
 * Send one event to TikTok. All fields optional except `event`.
 * @param {object} p
 * @param {string} p.event      - e.g. 'CompleteRegistration', 'CompletePayment'
 * @param {string} [p.eventId]  - dedup id
 * @param {number} [p.value]    - monetary value
 * @param {string} [p.currency] - ISO code, default 'USD'
 * @param {string} [p.email]    - raw email (hashed here)
 * @param {string} [p.ip]       - client IP (sent as-is)
 * @param {string} [p.userAgent]
 * @param {string} [p.url]      - page url
 */
const track = ({ event, eventId, value, currency = 'USD', email, ip, userAgent, url } = {}) => {
  if (!TOKEN || !PIXEL_ID || !event) return;

  const user = {};
  const e = hash(email);
  if (e) user.email = e;
  if (ip) user.ip = ip;
  if (userAgent) user.user_agent = userAgent;

  const data = {
    event,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId || crypto.randomUUID(),
    user,
    page: { url: url || SITE_URL },
  };
  if (value != null) data.properties = { value: Number(value), currency };

  const payload = {
    event_source: 'web',
    event_source_id: PIXEL_ID,
    data: [data],
  };
  // Optional: see events live under Events Manager → Test Events.
  if (process.env.TIKTOK_TEST_EVENT_CODE) payload.test_event_code = process.env.TIKTOK_TEST_EVENT_CODE;
  const body = JSON.stringify(payload);

  // Fire-and-forget; swallow all errors.
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Access-Token': TOKEN, 'Content-Type': 'application/json' },
    body,
  })
    .then(async (r) => {
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        console.error(`[TikTok] ${event} HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
    })
    .catch((err) => console.error(`[TikTok] ${event} send failed:`, err.message));
};

// Best-effort client IP from a (possibly proxied) Express request.
const ipOf = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  req.socket?.remoteAddress ||
  undefined;

module.exports = { track, ipOf };
