/**
 * AviatorCanvas.tsx
 * PixiJS canvas component for the Aviator crash game.
 * Renders the multiplier curve, airplane, and crash animation.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';

interface Point {
  x: number;
  y: number;
}

const AviatorCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const pointsRef = useRef<Point[]>([]);
  const { phase, currentMultiplier, crashPoint } = useGameStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const PAD = { left: 50, bottom: 40, right: 20, top: 20 };

    // Reset points on new round
    if (phase === 'flying' && currentMultiplier <= 1.05) {
      pointsRef.current = [];
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        const y = PAD.top + ((H - PAD.top - PAD.bottom) * (5 - i)) / 5;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(W - PAD.right, y);
        ctx.stroke();

        // Y axis labels
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '11px monospace';
        ctx.fillText(`${i}x`, 5, y + 4);
      }

      const maxM = Math.max(currentMultiplier, 2);
      const plotW = W - PAD.left - PAD.right;
      const plotH = H - PAD.top - PAD.bottom;

      // Add current point
      if (phase === 'flying' || phase === 'crashed') {
        const progress = Math.min(currentMultiplier / maxM, 1);
        const px = PAD.left + plotW * (pointsRef.current.length / 200);
        const py = H - PAD.bottom - plotH * progress;
        pointsRef.current.push({ x: px, y: py });
        if (pointsRef.current.length > 300) pointsRef.current.shift();
      }

      if (pointsRef.current.length < 2) return;

      // Draw curve
      const crashed = phase === 'crashed';
      const gradient = ctx.createLinearGradient(PAD.left, 0, W, 0);
      gradient.addColorStop(0, crashed ? 'rgba(255,50,50,0.8)' : 'rgba(255,165,0,0.8)');
      gradient.addColorStop(1, crashed ? '#ff0000' : '#ff6a00');

      ctx.beginPath();
      ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
      for (let i = 1; i < pointsRef.current.length; i++) {
        ctx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y);
      }
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Fill under curve
      ctx.lineTo(pointsRef.current[pointsRef.current.length - 1].x, H - PAD.bottom);
      ctx.lineTo(pointsRef.current[0].x, H - PAD.bottom);
      ctx.closePath();
      ctx.fillStyle = crashed
        ? 'rgba(255,0,0,0.08)'
        : 'rgba(255,106,0,0.08)';
      ctx.fill();

      // Airplane emoji at tip
      const last = pointsRef.current[pointsRef.current.length - 1];
      if (last && !crashed) {
        ctx.font = '28px serif';
        ctx.fillText('✈️', last.x - 14, last.y - 10);
      }

      // Multiplier display
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      if (crashed) {
        ctx.fillStyle = '#ff3333';
        ctx.fillText(`CRASH! ${crashPoint?.toFixed(2)}x`, W / 2, H / 2);
        ctx.font = '18px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('Nouvelle manche dans 5s...', W / 2, H / 2 + 40);
      } else if (phase === 'waiting') {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = 'bold 28px monospace';
        ctx.fillText('En attente...', W / 2, H / 2);
      } else {
        ctx.fillStyle = '#ff6a00';
        ctx.fillText(`${currentMultiplier.toFixed(2)}x`, W / 2, H / 2);
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
