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

const AviatorCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  // Timestamp when the current flying phase started (for the time axis)
  const flyStartRef = useRef<number>(0);
  const lastPhaseRef = useRef<string>('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const PAD = { left: 50, bottom: 36, right: 24, top: 24 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const originX = PAD.left;
    const originY = H - PAD.bottom; // bottom-left origin

    const draw = () => {
      // Read live state each frame (no effect re-run, no stacked loops)
      const { phase, currentMultiplier, crashPoint } = useGameStore.getState();
      const mult = currentMultiplier || 1.0;

      // Track when flying starts so the time axis is anchored correctly
      if (phase === 'flying' && lastPhaseRef.current !== 'flying') {
        flyStartRef.current = performance.now();
      }
      lastPhaseRef.current = phase;

      // ── Clear + background ──
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, W, H);

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

      // ── Grid + Y labels (dynamic based on maxM) ──
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const m = 1 + ((maxM - 1) * i) / steps;
        const y = mToY(m);
        ctx.beginPath();
        ctx.moveTo(originX, y);
        ctx.lineTo(W - PAD.right, y);
        ctx.stroke();
        ctx.fillText(`${m.toFixed(1)}x`, 6, y + 4);
      }

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
        gradient.addColorStop(0, crashed ? 'rgba(255,50,50,0.85)' : 'rgba(255,165,0,0.85)');
        gradient.addColorStop(1, crashed ? '#ff0000' : '#ff6a00');

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
        ctx.fillStyle = crashed ? 'rgba(255,0,0,0.08)' : 'rgba(255,106,0,0.08)';
        ctx.fill();

        // Airplane at the tip — clamped inside the plot so it never leaves
        if (!crashed) {
          const ax = Math.min(Math.max(tip.x, originX), W - PAD.right - 6);
          const ay = Math.min(Math.max(tip.y, PAD.top + 6), originY);
          ctx.font = '28px serif';
          ctx.textAlign = 'center';
          ctx.fillText('✈️', ax, ay);
        }
      }

      // ── Center multiplier / status text ──
      ctx.textAlign = 'center';
      if (crashed) {
        ctx.font = 'bold 46px monospace';
        ctx.fillStyle = '#ff3333';
        ctx.fillText(`CRASH ! ${(crashPoint ?? mult).toFixed(2)}x`, W / 2, H / 2);
        ctx.font = '16px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('Nouvelle manche bientôt...', W / 2, H / 2 + 36);
      } else if (phase === 'betting') {
        ctx.font = 'bold 30px monospace';
        ctx.fillStyle = '#22c55e';
        ctx.fillText('🎯 Faites vos jeux !', W / 2, H / 2);
        ctx.font = '15px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('Décollage imminent...', W / 2, H / 2 + 32);
      } else if (phase === 'flying') {
        ctx.font = 'bold 48px monospace';
        ctx.fillStyle = '#ff6a00';
        ctx.fillText(`${mult.toFixed(2)}x`, W / 2, H / 2);
      } else {
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('En attente...', W / 2, H / 2);
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
      className="w-full rounded-xl border border-orange-900/30"
      style={{ background: '#0d1117' }}
    />
  );
};

export default AviatorCanvas;
