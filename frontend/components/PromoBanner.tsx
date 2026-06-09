/**
 * PromoBanner.tsx
 * Dynamic promotional slider under the top bar: rotating "50 USDT OFFERT"
 * messages with a live countdown timer to create urgency.
 */

'use client';

import { useEffect, useState } from 'react';

const SLIDES = [
  { icon: '🎁', text: '50 USDT OFFERTS à l’inscription' },
  { icon: '🚀', text: 'Bonus de bienvenue : 50 USDT gratuits' },
  { icon: '🔥', text: 'Offre limitée — réclame tes 50 USDT' },
];

// Rolling 15-minute countdown, synced to the clock so it never stalls.
const WINDOW = 15 * 60;
const remainingSeconds = () => WINDOW - (Math.floor(Date.now() / 1000) % WINDOW);
const fmt = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

const PromoBanner = ({ onClaim }: { onClaim?: () => void }) => {
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(WINDOW);

  useEffect(() => {
    const tick = () => setLeft(remainingSeconds());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const r = setInterval(() => setI((v) => (v + 1) % SLIDES.length), 4000);
    return () => clearInterval(r);
  }, []);

  const s = SLIDES[i];

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-red-500">
      {/* shimmer */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmer_2.5s_linear_infinite]" />
      <div className="relative flex items-center justify-center gap-2 sm:gap-3 px-3 py-1.5 text-black">
        <span key={i} className="flex items-center gap-2 text-xs sm:text-sm font-black animate-[fadeIn_0.4s_ease] min-w-0">
          <span className="text-base shrink-0">{s.icon}</span>
          <span className="uppercase tracking-wide truncate">{s.text}</span>
        </span>
        <span className="flex items-center gap-1 bg-black/25 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums shrink-0">
          ⏱ {fmt(left)}
        </span>
        <button
          onClick={onClaim}
          className="bg-black text-white text-[11px] font-bold px-3 py-1 rounded-full hover:bg-gray-800 transition active:scale-95 whitespace-nowrap shrink-0"
        >
          RÉCLAMER
        </button>
      </div>
    </div>
  );
};

export default PromoBanner;
