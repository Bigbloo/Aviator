/**
 * config.js
 * Money-layer config. The crypto layer is "simulated" (mock) only when the
 * active payment provider has no key configured (local dev). In production the
 * provider is live for everyone; demo is opt-in PER REQUEST and admin-only.
 */

const provider = require('./providers');

module.exports = {
  isMock: () => !provider.available(),
  providerName: provider.name,
};
