/**
 * config.js
 * Money-layer config. The crypto provider is "simulated" only when no API key
 * is configured (local dev). In production the provider is live for everyone;
 * demo is opt-in PER REQUEST and only for the admin (see isDemoRequest in
 * middleware/auth) — regular players are always on the real money layer.
 */

const hasApiKey = !!process.env.NOWPAYMENTS_API_KEY;

module.exports = {
  isMock: () => !hasApiKey,
  hasApiKey,
};
