/**
 * AviatorCanvas.tsx
 * Canvas component for the Aviator crash game.
 * Renders the multiplier curve, airplane, and crash animation.
 *
 * Design notes:
 *  - ONE single requestAnimationFrame loop (started once on mount).
 *  - Game state is read live from the Zustand store via getState() inside the
 *    loop, so the effect does NOT re-run on every multiplier tick (which used
 *    to stack dozens of parallel rAF loops).
 *  - The curve is generated mathematically from elapsed time, always starting
 *    at the bottom-left origin.
 *  - Both X (time) and Y (multiplier) axes auto-scale so the airplane ALWAYS
 *    stays inside the viewport, no matter how high the multiplier climbs.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';

/**
 * Draws a stylized red prop-plane silhouette (Aviator-style) with the nose at
 * (x, y), pointing up-right along the flight path. `s` scales it to the canvas.
 */
function drawPlane(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const BODY = '#e8112d';
  const DARK = '#9c0f20';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08);
  ctx.scale(s, s);

  // Tail fin (back-left)
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.moveTo(-22, 3);
  ctx.lineTo(-32, -9);
  ctx.lineTo(-15, 1);
  ctx.closePath();
  ctx.fill();

  // Lower wing
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(-16, 22);
  ctx.lineTo(11, 6);
  ctx.closePath();
  ctx.fill();

  // Upper wing / cockpit canopy
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.moveTo(-2, -4);
  ctx.lineTo(-12, -18);
  ctx.lineTo(9, -5);
  ctx.closePath();
  ctx.fill();

  // Fuselage (tail -> nose)
  ctx.beginPath();
  ctx.moveTo(-24, 4);
  ctx.bezierCurveTo(-6, -4, 20, -5, 32, 1);
  ctx.bezierCurveTo(20, 8, -6, 9, -24, 5);
  ctx.closePath();
  ctx.fill();

  // Nose hub
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.ellipse(31, 1, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spinning propeller (motion-blur ellipse)
  ctx.strokeStyle = 'rgba(232,17,45,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(34, 1, 2, 12, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Honest "tension" intensity in [0,1], derived purely from the LIVE multiplier
 * the player already sees on screen. It drives presentation only — background
 * warmth and haptic pulses. It never touches the multiplier, the crash point,
 * or any game logic, so it cannot affect fairness or outcomes. The ramp is
 * monotonic (higher multiplier = more intense), with no slow-downs or
 * "false hope" shaping of the curve.
 */
function tensionFromMultiplier(mult: number): number {
  const t = Math.min(1, Math.max(0, (mult - 1) / (5 - 1))); // 1x → 0, 5x → 1
  return t * t * (3 - 2 * t); // smoothstep for a soft feel
}

const AviatorCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  // Timestamp when the current flying phase started (for the time axis)
  const flyStartRef = useRef<number>(0);
  const lastPhaseRef = useRef<string>('');
  // Optional plane sprite (public/plane.png). Falls back to the vector plane.
  const planeImg = useRef<HTMLImageElement | null>(null);
  const planeReady = useRef(false);
  // Throttle for the optional haptic feedback (mobile only, opt-in by browser).
  const lastHapticRef = useRef<number>(0);
  // Accumulated sunburst rotation angle + last frame time, so the spin is
  // continuous (no jumps) and can smoothly change speed with tension.
  const spinRef = useRef<number>(0);
  const lastSpinTsRef = useRef<number>(0);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { planeReady.current = true; };
    img.onerror = () => { planeReady.current = false; };
    img.src = '/plane.png';
    planeImg.current = img;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // No axis gutter on the left/bottom: the flight path and the sunburst both
    // converge at the true bottom-left corner of the canvas.
    const PAD = { left: 0, bottom: 0, right: 24, top: 24 };

    // Keep the canvas backing store matched to its displayed (CSS) size so the
    // game fills its container at any width/height without stretching.
    const fitCanvas = () => {
      const cw = Math.max(1, Math.round(canvas.clientWidth));
      const ch = Math.max(1, Math.round(canvas.clientHeight));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
    };

    const draw = () => {
      fitCanvas();
      const W = canvas.width;
      const H = canvas.height;
      const plotW = W - PAD.left - PAD.right;
      const plotH = H - PAD.top - PAD.bottom;
      const originX = PAD.left;
      const originY = H - PAD.bottom; // bottom-left origin

      // Draw the plane (PNG sprite, vector fallback) at a given anchor point.
      const renderPlane = (ax: number, ay: number) => {
        const img = planeImg.current;
        if (planeReady.current && img && img.width) {
          const targetW = Math.min(130, Math.max(70, W * 0.13));
          const targetH = targetW * (img.height / img.width);
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(-0.02); // near-level — keep the plane stable, not steeply tilted
          // The curve meets the plane at its REAR (tail, lower-left of the
          // sprite); the plane extends forward (up-right) from there.
          ctx.drawImage(img, -targetW * 0.12, -targetH * 0.70, targetW, targetH);
          ctx.restore();
        } else {
          const planeScale = Math.min(1.5, Math.max(0.85, Math.min(W, H) / 300));
          drawPlane(ctx, ax, ay, planeScale);
        }
      };

      // Read live state each frame (no effect re-run, no stacked loops)
      const { phase, currentMultiplier, crashPoint } = useGameStore.getState();
      const mult = currentMultiplier || 1.0;

      // Track when flying starts so the time axis is anchored correctly
      if (phase === 'flying' && lastPhaseRef.current !== 'flying') {
        flyStartRef.current = performance.now();
      }
      const prevPhase = lastPhaseRef.current;
      lastPhaseRef.current = phase;

      // Honest tension intensity from the live multiplier (presentation only).
      const tension = phase === 'flying' ? tensionFromMultiplier(mult) : 0;

      // ── Background: rotating sunburst + radial glow (Aviator look) ──
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#06070b';
      ctx.fillRect(0, 0, W, H);

      // Dark blue-grey rays radiating from the plane's take-off origin. The
      // rotation is integrated frame-by-frame so it never jumps; its angular
      // speed rises smoothly with tension (faster as the multiplier climbs
      // toward a likely crash, mirroring the warm glow). Pure presentation.
      const nowMs = performance.now();
      const dt = lastSpinTsRef.current ? Math.min(0.1, (nowMs - lastSpinTsRef.current) / 1000) : 0;
      lastSpinTsRef.current = nowMs;
      const angVel = 0.05 + tension * 0.45; // rad/s — slow at rest, fast near crash
      spinRef.current = (spinRef.current + dt * angVel) % (Math.PI * 2);

      const rayR = Math.hypot(W, H) * 1.2;
      const RAY_COUNT = 26;
      const slot = (Math.PI * 2) / RAY_COUNT; // angle between ray centers
      const rayHalf = slot * 0.14;            // thin rays (~28% of each slot)
      ctx.save();
      ctx.fillStyle = '#141d2a';
      for (let i = 0; i < RAY_COUNT; i++) {
        const c = spinRef.current + i * slot;
        const a0 = c - rayHalf;
        const a1 = c + rayHalf;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX + Math.cos(a0) * rayR, originY + Math.sin(a0) * rayR);
        ctx.lineTo(originX + Math.cos(a1) * rayR, originY + Math.sin(a1) * rayR);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Soft glow, upper-middle. Bluish at rest; warms toward orange as the
      // multiplier the player already sees climbs.
      const glowX = W * 0.52;
      const glowY = H * 0.42;
      const gr = Math.round(45 + tension * 150);
      const gg = Math.round(95 - tension * 30);
      const gb = Math.round(155 - tension * 110);
      const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, Math.max(W, H) * 0.55);
      glow.addColorStop(0, `rgba(${gr},${gg},${gb},0.55)`);
      glow.addColorStop(0.5, `rgba(${gr},${gg},${gb},0.16)`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // ── Haptic feedback (optional, mobile browsers that support it) ──
      // Tied strictly to the visible multiplier; intensity and cadence rise
      // with tension. Crash fires one distinct buzz. No-op where unsupported.
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        const now = performance.now();
        if (phase === 'flying') {
          // Pulse every 600ms→260ms as tension rises; pulse length 6→26ms.
          const interval = 600 - tension * 340;
          if (now - lastHapticRef.current >= interval) {
            lastHapticRef.current = now;
            navigator.vibrate(Math.round(6 + tension * 20));
          }
        } else if (phase === 'crashed' && prevPhase === 'flying') {
          navigator.vibrate([40, 30, 80]);
        }
      }

      // ── Auto-scaling ──
      // Y axis spans from 1x up to at least 2x, growing with the multiplier
      // (with 20% headroom) so the plane never leaves the top.
      const maxM = Math.max(2, mult * 1.2);
      // Time axis: assume a round visually fills ~10s, but compress as it grows
      const elapsed = phase === 'flying' ? (performance.now() - flyStartRef.current) / 1000 : 0;
      const maxT = Math.max(8, elapsed * 1.15); // seconds shown, auto-grows

      // map multiplier -> y (1x at bottom, maxM at top)
      const mToY = (m: number) => originY - (plotH * (m - 1)) / (maxM - 1);
      // map time -> x
      const tToX = (t: number) => originX + (plotW * t) / maxT;

      const crashed = phase === 'crashed';
      const flying = phase === 'flying';

      // ── Curve (only while flying / crashed) ──
      if ((flying || crashed) && elapsed > 0) {
        // Build the curve from the exponential growth: sample time 0..elapsed.
        // M(t) = exp(k*t) — we invert mToY using the multiplier at each sample.
        const SAMPLES = 60;
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= SAMPLES; i++) {
          const t = (elapsed * i) / SAMPLES;
          // reconstruct multiplier at time t from current mult & elapsed
          // (linear-in-log interpolation keeps the curve shape consistent)
          const m = elapsed > 0 ? Math.pow(mult, t / elapsed) : 1;
          pts.push({ x: tToX(t), y: mToY(m) });
        }

        // Curve stroke
        const gradient = ctx.createLinearGradient(originX, 0, W, 0);
        gradient.addColorStop(0, crashed ? 'rgba(255,50,50,0.85)' : 'rgba(255,70,90,0.9)');
        gradient.addColorStop(1, crashed ? '#ff0000' : '#e8112d');

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Fill under curve
        const tip = pts[pts.length - 1];
        ctx.lineTo(tip.x, originY);
        ctx.lineTo(pts[0].x, originY);
        ctx.closePath();
        ctx.fillStyle = crashed ? 'rgba(255,0,0,0.08)' : 'rgba(232,17,45,0.12)';
        ctx.fill();

        // Airplane at the tip — clamped inside the plot so it never leaves
        if (!crashed) {
          const ax = Math.min(Math.max(tip.x, originX + 20), W - PAD.right - 10);
          const ay = Math.min(Math.max(tip.y, PAD.top + 14), originY - 4);
          renderPlane(ax, ay);
        }
      }

      // ── Center multiplier / status text ──
      // Scale the font to the canvas width so it isn't oversized on phones.
      const k = Math.min(1.15, Math.max(0.5, W / 700));
      const px = (n: number) => `${Math.round(n * k)}px`;
      ctx.textAlign = 'center';
      if (crashed) {
        ctx.font = `bold ${px(44)} monospace`;
        ctx.fillStyle = '#ff3333';
        ctx.fillText(`CRASHED ! ${(crashPoint ?? mult).toFixed(2)}x`, W / 2, H / 2);
        ctx.font = `${px(15)} monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('Next round starting soon...', W / 2, H / 2 + 34 * k);
      } else if (phase === 'betting') {
        // Plane waiting in the bottom-left corner — exactly where it sits at
        // the start of flight, so it's the same plane that then takes off.
        renderPlane(originX + 20, originY - 4);

        ctx.font = `bold ${px(28)} monospace`;
        ctx.fillStyle = '#22c55e';
        ctx.fillText('Place your bets !', W / 2, H / 2 - 12 * k);

        // Progress gauge that fills as take-off approaches (replaces the
        // textual countdown). Driven purely by the betting-window timing.
        const endsAt = (window as any).__bettingEndsAt || 0;
        const total = (window as any).__bettingMs || 0;
        const remainMs = Math.max(0, endsAt - Date.now());
        const frac = total > 0 ? Math.min(1, Math.max(0, 1 - remainMs / total)) : 0;

        const barW = Math.min(W * 0.5, 280);
        const barH = Math.max(8, 10 * k);
        const barX = W / 2 - barW / 2;
        const barY = H / 2 + 16 * k;
        const r = barH / 2;
        const roundRectPath = (x: number, y: number, w: number, h: number) => {
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
          else ctx.rect(x, y, w, h);
        };

        // Track
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        roundRectPath(barX, barY, barW, barH);
        ctx.fill();

        // Fill (green → orange as it nears take-off)
        if (frac > 0) {
          const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
          grad.addColorStop(0, '#22c55e');
          grad.addColorStop(1, '#ff7a00');
          ctx.fillStyle = grad;
          roundRectPath(barX, barY, Math.max(barH, barW * frac), barH);
          ctx.fill();
        }
      } else if (phase === 'flying') {
        ctx.font = `bold ${px(48)} monospace`;
        ctx.fillStyle = '#ff6a00';
        ctx.fillText(`${mult.toFixed(2)}x`, W / 2, H / 2);
      } else {
        ctx.font = `bold ${px(26)} monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('Waiting...', W / 2, H / 2);
      }
      ctx.textAlign = 'left';
    };

    const loop = () => {
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animRef.current);
    // Empty deps: the loop runs ONCE and reads live state internally.
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={350}
      className="absolute inset-0 w-full h-full block"
      style={{ background: '#0d1117' }}
    />
  );
};

export default AviatorCanvas;
