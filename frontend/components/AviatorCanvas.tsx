/**
 * AviatorCanvas.tsx
 * Canvas du jeu Aviator avec :
 *  - Interface de stress visuel : fond qui vire vers des teintes chaudes selon la tension
 *  - Crash asynchrone progressif : courbe avec ralentissement puis accélération
 *  - Affichage du seed individualisé (vérifiabilité)
 */

'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';

interface Point {
  x: number;
  y: number;
  multiplier: number;
}

// ── Interpolation de couleur de fond selon la tension ─────────────────────────
/**
 * Retourne une couleur de fond interpolée entre bleu-nuit (repos) et rouge-chaud (danger).
 * tensionLevel 0 → '#0d1117' (bleu nuit)
 * tensionLevel 1 → '#2d0a00' (rouge sombre)
 */
const getTensionBgColor = (tensionLevel: number): string => {
  // Composantes RGB de départ (repos) et d'arrivée (danger)
  const start = { r: 13,  g: 17,  b: 23  }; // #0d1117
  const end   = { r: 45,  g: 10,  b: 0   }; // #2d0a00
  const t = Math.min(Math.max(tensionLevel, 0), 1);
  const r = Math.round(start.r + (end.r - start.r) * t);
  const g = Math.round(start.g + (end.g - start.g) * t);
  const b = Math.round(start.b + (end.b - start.b) * t);
  return `rgb(${r},${g},${b})`;
};

/**
 * Retourne la couleur de la courbe selon la tension.
 * Passe de orange → rouge vif à mesure que la tension monte.
 */
const getCurveColor = (tensionLevel: number, crashed: boolean): string => {
  if (crashed) return 'rgba(255,30,30,0.95)';
  if (tensionLevel > 0.8) return 'rgba(255,50,0,0.95)';
  if (tensionLevel > 0.5) return 'rgba(255,100,0,0.9)';
  return 'rgba(255,165,0,0.9)';
};

const AviatorCanvas = () => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const pointsRef   = useRef<Point[]>([]);
  const tickRef     = useRef<number>(0);
  const prevPhaseRef = useRef<string>('waiting');

  const { phase, currentMultiplier, crashPoint, tensionLevel, sessionSeed, serverSeed } = useGameStore();

  // Reset courbe au début d'un nouveau round
  useEffect(() => {
    if (phase === 'flying' && prevPhaseRef.current !== 'flying') {
      pointsRef.current = [];
      tickRef.current   = 0;
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

      // ── Interface de stress visuel : fond interpolé selon la tension ──────
      const bgColor = phase === 'crashed'
        ? '#1a0000'
        : getTensionBgColor(tensionLevel);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      // Overlay de chaleur subtil quand tension > 0.5
      if (tensionLevel > 0.5 && phase === 'flying') {
        const heatAlpha = (tensionLevel - 0.5) * 0.15;
        ctx.fillStyle = `rgba(255, 60, 0, ${heatAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }

      // Déterminer l'échelle Y
      const maxM = Math.max(currentMultiplier * 1.2, 2.5);

      // Lignes de grille + labels Y
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

      // Ajouter le point courant
      if (phase === 'flying' || phase === 'crashed') {
        tickRef.current += 1;
        const MAX_TICKS = 300;
        const xProgress = Math.min(tickRef.current / MAX_TICKS, 1);
        const px = PAD.left + plotW * xProgress;
        const yProgress = Math.min((currentMultiplier - 1) / (maxM - 1), 1);
        const py = H - PAD.bottom - plotH * yProgress;
        pointsRef.current.push({ x: px, y: py, multiplier: currentMultiplier });
      }

      if (pointsRef.current.length < 2) {
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
      const curveColor = getCurveColor(tensionLevel, crashed);

      // ── Dessin de la courbe ───────────────────────────────────────────────
      const gradient = ctx.createLinearGradient(PAD.left, 0, W, 0);
      gradient.addColorStop(0, crashed ? 'rgba(255,50,50,0.9)' : 'rgba(255,165,0,0.9)');
      gradient.addColorStop(1, curveColor);

      ctx.beginPath();
      ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
      for (let i = 1; i < pointsRef.current.length; i++) {
        const prev = pointsRef.current[i - 1];
        const curr = pointsRef.current[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      const last = pointsRef.current[pointsRef.current.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = tensionLevel > 0.7 ? 4 : 3; // courbe plus épaisse sous tension
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Remplissage sous la courbe
      ctx.lineTo(last.x, H - PAD.bottom);
      ctx.lineTo(pointsRef.current[0].x, H - PAD.bottom);
      ctx.closePath();
      ctx.fillStyle = crashed
        ? 'rgba(255,0,0,0.12)'
        : `rgba(255,${Math.round(106 - tensionLevel * 80)},0,${0.08 + tensionLevel * 0.08})`;
      ctx.fill();

      // Avion au bout de la courbe
      if (last && !crashed) {
        ctx.font = '26px serif';
        ctx.fillText('✈️', last.x - 12, last.y - 12);

        // Halo de danger quand tension > 0.7
        if (tensionLevel > 0.7) {
          const haloAlpha = (tensionLevel - 0.7) * 0.6;
          const haloRadius = 20 + tensionLevel * 15;
          const halo = ctx.createRadialGradient(last.x, last.y - 12, 0, last.x, last.y - 12, haloRadius);
          halo.addColorStop(0, `rgba(255,50,0,${haloAlpha})`);
          halo.addColorStop(1, 'rgba(255,50,0,0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(last.x, last.y - 12, haloRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Affichage du multiplicateur
      ctx.textAlign = 'center';
      if (crashed) {
        ctx.font = 'bold 48px monospace';
        ctx.fillStyle = '#ff3333';
        ctx.fillText(`CRASH! ${crashPoint?.toFixed(2)}x`, W / 2, H / 2);
        ctx.font = '16px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('Nouvelle manche dans 5s...', W / 2, H / 2 + 36);
      } else {
        // Couleur du multiplicateur selon la tension
        const multColor = tensionLevel > 0.8
          ? '#ff3300'
          : tensionLevel > 0.5
          ? '#ff6600'
          : '#ffffff';
        ctx.font = `bold ${tensionLevel > 0.7 ? 52 : 44}px monospace`;
        ctx.fillStyle = multColor;
        ctx.shadowColor = tensionLevel > 0.5 ? `rgba(255,100,0,${tensionLevel * 0.5})` : 'transparent';
        ctx.shadowBlur = tensionLevel > 0.5 ? 20 : 0;
        ctx.fillText(`${currentMultiplier.toFixed(2)}x`, W / 2, H / 2);
        ctx.shadowBlur = 0;
      }
      ctx.textAlign = 'left';

      // Indicateur de tension (barre en bas)
      if (phase === 'flying' && tensionLevel > 0.1) {
        const barW = (W - PAD.left - PAD.right) * tensionLevel;
        const barH = 4;
        const barY = H - 8;
        const barGrad = ctx.createLinearGradient(PAD.left, 0, PAD.left + barW, 0);
        barGrad.addColorStop(0, 'rgba(255,200,0,0.8)');
        barGrad.addColorStop(1, `rgba(255,${Math.round(50 - tensionLevel * 50)},0,0.9)`);
        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.roundRect(PAD.left, barY, barW, barH, 2);
        ctx.fill();
      }

      // Seed individualisé — affiché discrètement en bas
      if (sessionSeed && serverSeed && phase !== 'waiting') {
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.textAlign = 'right';
        ctx.fillText(
          `seed: ${serverSeed.slice(0, 8)}…${sessionSeed.slice(0, 6)}`,
          W - PAD.right,
          H - 12
        );
        ctx.textAlign = 'left';
      }
    };

    draw();
  }, [phase, currentMultiplier, crashPoint, tensionLevel, sessionSeed, serverSeed]);

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        width={700}
        height={380}
        className="w-full rounded-xl border border-orange-900/30"
        style={{
          // Transition douce de la bordure selon la tension
          borderColor: tensionLevel > 0.7
            ? `rgba(255,${Math.round(100 - tensionLevel * 100)},0,0.6)`
            : undefined,
          boxShadow: tensionLevel > 0.6
            ? `0 0 ${Math.round(tensionLevel * 30)}px rgba(255,60,0,${tensionLevel * 0.3})`
            : undefined,
          transition: 'border-color 0.3s, box-shadow 0.3s',
        }}
      />
    </div>
  );
};

export default AviatorCanvas;
