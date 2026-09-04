/**
 * sound.ts
 * Lightweight sound effects using the Web Audio API (no asset files needed).
 * Sounds are synthesized on the fly. Respects a global mute flag.
 */

let ctx: AudioContext | null = null;
let muted = false;
let lifecycleBound = false;

/**
 * Nothing should be audible from a page the player is not looking at.
 *
 * Rounds keep arriving over the socket while a tab sits in the background or
 * the installed PWA is behind another window, so an auto-cashout could fire
 * its chime from a page that to the player looks closed. Suspending on hide
 * also releases the audio device, instead of holding it open for the life of
 * the tab as an idle resumed context does.
 */
const bindLifecycle = () => {
  if (lifecycleBound || typeof document === 'undefined') return;
  lifecycleBound = true;

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (!muted) ctx.resume().catch(() => {});
  });

  // pagehide, not beforeunload: it is the one that fires reliably on Safari
  // and on mobile, and it also covers entering the back/forward cache.
  window.addEventListener('pagehide', () => {
    if (!ctx) return;
    ctx.close().catch(() => {});
    ctx = null;
  });
};

const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  // Stay silent while hidden rather than resuming a suspended context. This
  // also drops the second note of a two-note chime if the page is hidden
  // mid-sequence, which is the wanted behaviour.
  if (typeof document !== 'undefined' && document.hidden) return null;
  if (!ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    bindLifecycle();
  }
  const c = ctx;
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  return c;
};

export const setMuted = (v: boolean) => {
  muted = v;
  if (!ctx) return;
  // Muting releases the audio device too, rather than leaving a live context
  // running silently.
  if (v) ctx.suspend().catch(() => {});
  else if (typeof document !== 'undefined' && !document.hidden) ctx.resume().catch(() => {});
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
