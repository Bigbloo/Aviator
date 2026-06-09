/**
 * PromoBanner.tsx
 * Promotional bar pinned at the very top: a continuously scrolling (marquee)
 * "50 USDT OFFERT" message with a prominent live countdown timer.
 */

'use client';

import { useEffect, useState } from 'react';

// Rolling 15-minute countdown, synced to the clock so it never stalls.
const WINDOW = 15 * 60;
const remaining = () => WINDOW - (Math.floor(Date.now() / 1000) % WINDOW);
const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const SEP = '  •  ';
const MSG =
  `🎁 50 USDT OFFERTS à l’inscription${SEP}🚀 Bonus de bienvenue : 50 USDT gratuits${SEP}🔥 Offre limitée — réclame tes 50 USDT${SEP}`;

const PromoBanner = ({ onClaim }: { onClaim?: () => void }) => {
  const [left, setLeft] = useState(WINDOW);

  useEffect(() => {
    const tick = () => setLeft(remaining());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <button
      onClick={onClaim}
      title="Réclamer 50 USDT"
      className="group flex items-center gap-2 w-full max-w-md min-w-0 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-black pl-3 pr-1.5 py-1 overflow-hidden ring-1 ring-amber-300/40 active:scale-[0.99] transition"
    >
      {/* Scrolling message */}
      <div className="flex-1 overflow-hidden min-w-0">
        <div className="inline-flex whitespace-nowrap will-change-transform animate-[marquee_20s_linear_infinite] font-black text-[11px] sm:text-xs uppercase tracking-wide">
          <span className="px-2">{MSG}</span>
          <span className="px-2">{MSG}</span>
        </div>
      </div>

      {/* Prominent countdown */}
      <span className="shrink-0 flex items-center gap-1 bg-black text-white rounded-full px-2.5 py-1 text-sm sm:text-base font-black tabular-nums ring-1 ring-white/20">
        <span className="text-amber-400 text-[11px] animate-pulse">⏱</span>
        {fmt(left)}
      </span>
    </button>
  );
};

export default PromoBanner;
