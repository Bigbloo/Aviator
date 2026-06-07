/**
 * AviatorCanvas.tsx
 * PixiJS-style canvas component for the Aviator crash game.
 * Renders the multiplier curve, airplane, and crash animation using Canvas 2D API.
 *
 * X-axis: time-based (tracks elapsed ticks)
 * Y-axis: multiplier value (normalized to visible range)
 */

'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';

interface Point {
  x: number; // canvas pixel X
  y: number; // canvas pixel Y
  multiplier: number;
}

const AviatorCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const pointsRef = useRef<Point[]>([]);
  const tickRef = useRef<number>(0); // counts ticks for X progression
  const { phase, currentMultiplier, crashPoint } = useGameStore();

  // Reset curve when a new round starts (multiplier resets to ~1.0)
  const prevPhaseRef = useRef<string>('waiting');
  useEffect(() => {
    if (phase === 'flying' && prevPhaseRef.current !== 'flying') {
      pointsRef.current = [];
      tickRef.current = 0;
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const PAD = { left: 50, bottom: 40, right: 20, top: 20 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, W, H);

      // Determine Y scale: at least show up to 2x, expand as multiplier grows
      const maxM = Math.max(currentMultiplier * 1.2, 2.5);

      // Grid lines + Y labels
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      const gridSteps = [1, 1.5, 2, 3, 5, 10, 20, 50, 100];
      const visibleSteps = gridSteps.filter((v) => v <= maxM);
      visibleSteps.forEach((val) => {
        const y = H - PAD.bottom - plotH * ((val - 1) / (maxM - 1));
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(W - PAD.right, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${val}x`, PAD.left - 4, y + 4);
      });
      ctx.textAlign = 'left';

      // Add current point (time-based X)
      if (phase === 'flying' || phase === 'crashed') {
        tickRef.current += 1;
        // X: spread across 80% of plot width over ~300 ticks (30s at 100ms)
        const MAX_TICKS = 300;
        const xProgress = Math.min(tickRef.current / MAX_TICKS, 1);
        const px = PAD.left + plotW * xProgress;
        // Y: normalize multiplier to plot height
        const yProgress = Math.min((currentMultiplier - 1) / (maxM - 1), 1);
        const py = H - PAD.bottom - plotH * yProgress;
        pointsRef.current.push({ x: px, y: py, multiplier: currentMultiplier });
      }

      if (pointsRef.current.length < 2) {
        // Show waiting state
        if (phase === 'waiting') {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.font = 'bold 28px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('En attente...', W / 2, H / 2);
          ctx.textAlign = 'left';
        }
        return;
      }

      const crashed = phase === 'crashed';

      // Draw curve
      const gradient = ctx.createLinearGradient(PAD.left, 0, W, 0);
      gradient.addColorStop(0, crashed ? 'rgba(255,50,50,0.9)' : 'rgba(255,165,0,0.9)');
      gradient.addColorStop(1, crashed ? '#ff0000' : '#ff6a00');

      ctx.beginPath();
      ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
      for (let i = 1; i < pointsRef.current.length; i++) {
        // Smooth curve using quadratic bezier
        const prev = pointsRef.current[i - 1];
        const curr = pointsRef.current[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      const last = pointsRef.current[pointsRef.current.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Fill under curve
      ctx.lineTo(last.x, H - PAD.bottom);
      ctx.lineTo(pointsRef.current[0].x, H - PAD.bottom);
      ctx.closePath();
      ctx.fillStyle = crashed ? 'rgba(255,0,0,0.08)' : 'rgba(255,106,0,0.08)';
      ctx.fill();

      // Airplane emoji at tip of curve
      if (last && !crashed) {
        ctx.font = '26px serif';
        ctx.fillText('✈️', last.x - 12, last.y - 12);
      }

      // Multiplier display (center of canvas)
      ctx.textAlign = 'center';
      if (crashed) {
        ctx.font = 'bold 48px monospace';
        ctx.fillStyle = '#ff3333';
        ctx.fillText(`CRASH! ${crashPoint?.toFixed(2)}x`, W / 2, H / 2);
        ctx.font = '16px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('Nouvelle manche dans 5s...', W / 2, H / 2 + 36);
      } else {
        ctx.font = 'bold 52px monospace';
        ctx.fillStyle = '#ff6a00';
        // Subtle shadow for readability
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 12;
        ctx.fillText(`${currentMultiplier.toFixed(2)}x`, W / 2, H / 2);
        ctx.shadowBlur = 0;
      }
      ctx.textAlign = 'left';
    };

    const loop = () => {
      draw();
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [phase, currentMultiplier, crashPoint]);

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
