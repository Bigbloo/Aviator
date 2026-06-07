function generateCrashPoint() {
  const u = Math.random();
  const lambda = 0.7;
  const crash = Math.max(1.01, Number((1 + (-Math.log(1 - u) / lambda)).toFixed(2)));
  return crash;
}

function calculateMultiplier(elapsedMs) {
  const seconds = elapsedMs / 1000;
  return Number((1 + 0.15 * seconds + 0.05 * seconds * seconds).toFixed(2));
}

module.exports = { generateCrashPoint, calculateMultiplier };
