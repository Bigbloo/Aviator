/**
 * config.js
 * Runtime-mutable money-layer config. DEMO mode can be toggled at runtime by an
 * admin (discreet in-app switch) without a redeploy. Single-process state
 * (Railway runs 1 replica), reset to the DEMO_MODE env value on restart.
 */

let demo = process.env.DEMO_MODE === 'true';
const hasApiKey = !!process.env.NOWPAYMENTS_API_KEY;

module.exports = {
  isDemo: () => demo,
  // Simulated money layer when in demo, or when no provider key is configured.
  isMock: () => demo || !hasApiKey,
  setDemo: (v) => { demo = !!v; },
  hasApiKey,
};
