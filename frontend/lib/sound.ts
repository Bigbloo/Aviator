/**
 * sound.ts
 * Lightweight sound effects using the Web Audio API (no asset files needed).
 * Sounds are synthesized on the fly. Respects a global mute flag.
 */

let ctx: AudioContext | null = null;
let muted = false;

const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  const c = ctx;
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  return c;
};

export const setMuted = (v: boolean) => {
  muted = v;
};
export const isMuted = () => muted;

/** Play a simple tone. */
const tone = (freq: number, durMs: number, type: OscillatorType = 'sine', gain = 0.15) => {
  const c = getCtx();
  if (!c || muted) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(c.destination);
  const now = c.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
  osc.start(now);
  osc.stop(now + durMs / 1000);
};

/** Takeoff: rising sweep. */
export const playTakeoff = () => {
  const c = getCtx();
  if (!c || muted) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sawtooth';
  const now = c.currentTime;
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(660, now + 0.4);
  g.gain.setValueAtTime(0.12, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.45);
};

/** Cashout win: pleasant two-note chime. */
export const playCashout = () => {
  tone(880, 120, 'sine', 0.18);
  setTimeout(() => tone(1320, 180, 'sine', 0.18), 110);
};

/** Crash: descending buzz. */
export const playCrash = () => {
  const c = getCtx();
  if (!c || muted) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'square';
  const now = c.currentTime;
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.5);
  g.gain.setValueAtTime(0.16, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.55);
};
