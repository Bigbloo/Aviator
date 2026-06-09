/**
 * PromoBanner.tsx
 * Promo pill in the header: a continuously scrolling "50 USDT FREE" marquee with
 * a prominent multi-day countdown (persisted per visitor, ~2 days + hours).
 */

'use client';

import { useEffect, useState } from 'react';

const SEP = '  •  ';
const MSG =
  `🎁 50 USDT FREE on sign-up${SEP}🚀 Welcome bonus: 50 USDT${SEP}🔥 Limited offer — claim your 50 USDT${SEP}`;

const KEY = 'aviator_promo_deadline';

// Per-visitor deadline ~2 days + a few hours; resets once it expires.
const computeDeadline = (): number => {
  if (typeof window === 'undefined') return Date.now() + (2 * 86400 + 7 * 3600) * 1000;
  let d = Number(localStorage.getItem(KEY) || 0);
  if (!d || d < Date.now()) {
    d = Date.now() + (2 * 86400 + (3 + Math.floor(Math.random() * 9)) * 3600) * 1000; // 2d + 3..11h
    localStorage.setItem(KEY, String(d));
  }
  return d;
};

const fmt = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d}d ${p(h)}:${p(m)}:${p(sec)}`;
};

const PromoBanner = ({ onClaim }: { onClaim?: () => void }) => {
  const [left, setLeft] = useState((2 * 86400 + 7 * 3600) * 1000);

  useEffect(() => {
    const dl = computeDeadline();
    const tick = () => setLeft(dl - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <button
      onClick={onClaim}
      title="Claim 50 USDT"
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
      <span className="shrink-0 flex items-center gap-1 bg-black text-white rounded-full px-2.5 py-1 text-xs sm:text-sm font-black tabular-nums ring-1 ring-white/20">
        <span className="text-amber-400 text-[11px] animate-pulse">⏱</span>
        {fmt(left)}
      </span>
    </button>
  );
};

export default PromoBanner;
