/**
 * topWins.js
 * Rolling list of the biggest wins, used by the "Top Winners" board. It's fed
 * by real round results (big bot/player cashouts) and kept lively with the odd
 * generated big win, so the board evolves over time instead of being static.
 */

const MASK = 'abcdefghijklmnopqrstuvwxyz0123456789';
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const maskedName = () => `${pick(MASK)}***${Math.floor(Math.random() * 9) + 1}`;

// Bet sizes weighted toward small stakes (most players bet little).
const weightedBet = () => {
  const r = Math.random();
  if (r < 0.55) return pick([1, 2, 3, 5, 10]);
  if (r < 0.85) return pick([15, 20, 25, 50]);
  if (r < 0.97) return pick([75, 100, 150, 200]);
  return pick([300, 500, 1000]);
};

// Cashout multipliers weighted toward lower values, with rare huge wins.
const weightedMult = () => {
  const r = Math.random();
  if (r < 0.5) return +(2 + Math.random() * 6).toFixed(2); // 2–8x
  if (r < 0.82) return +(8 + Math.random() * 22).toFixed(2); // 8–30x
  if (r < 0.96) return +(30 + Math.random() * 70).toFixed(2); // 30–100x
  return +(100 + Math.random() * 900).toFixed(2); // 100–1000x
};

const CAP = 60;
let wins = [];

const norm = (w) => ({
  name: w.name,
  bet: w.bet,
  multiplier: w.multiplier,
  payout: Math.round(w.bet * w.multiplier * 100) / 100,
  at: w.at || Math.floor(Date.now() / 1000),
});

const record = (w) => {
  if (!w || !w.name || !(w.bet > 0) || !(w.multiplier > 1)) return;
  wins.push(norm(w));
  wins.sort((a, b) => b.payout - a.payout);
  if (wins.length > CAP) wins = wins.slice(0, CAP);
};

const list = () => wins.slice();

// Seed an established-looking board spread over the last few hours.
const seedNow = Math.floor(Date.now() / 1000);
for (let i = 0; i < CAP; i++) {
  record({
    name: maskedName(),
    bet: weightedBet(),
    multiplier: weightedMult(),
    at: seedNow - Math.floor(Math.random() * 6 * 3600),
  });
}

// Keep it alive: a fresh (occasionally huge) win every ~30s.
setInterval(() => {
  record({ name: maskedName(), bet: weightedBet(), multiplier: weightedMult() });
}, 30000);

module.exports = { record, list, maskedName, weightedBet };
