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
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-black">
      <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5">
        {/* Scrolling message */}
        <div className="flex-1 overflow-hidden">
          <div className="inline-flex whitespace-nowrap will-change-transform animate-[marquee_22s_linear_infinite] font-black text-xs sm:text-sm uppercase tracking-wide">
            <span className="px-2">{MSG}</span>
            <span className="px-2">{MSG}</span>
          </div>
        </div>

        {/* Prominent countdown */}
        <span className="shrink-0 flex items-center gap-1.5 bg-black text-white rounded-lg px-3 py-1 text-base sm:text-lg font-black tabular-nums shadow-md ring-1 ring-white/20">
          <span className="text-amber-400 text-sm animate-pulse">⏱</span>
          {fmt(left)}
        </span>

        <button
          onClick={onClaim}
          className="shrink-0 bg-black text-white text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-full hover:bg-gray-800 transition active:scale-95 whitespace-nowrap"
        >
          RÉCLAMER
        </button>
      </div>
    </div>
  );
};

export default PromoBanner;
