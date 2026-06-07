function generateCrashPoint() {
  const raw = 1.0 / (1.0 - Math.random()) ** 0.8;
  return Math.min(1000, Number(Math.max(1.0, raw).toFixed(2)));
}
module.exports = { generateCrashPoint };
