/**
 * HistoryBar.tsx
 * Aviator-style row of recent crash multipliers as rounded pills.
 * Color-coded by tier: blue < 2x, purple < 10x, pink >= 10x. Each pill is
 * tinted with its tier color; the row fades out on the right and ends with a
 * pinned history button.
 */

'use client';

import { useGameStore } from '@/store/gameStore';

/** Tier styling (text + faint matching background tint + ring). */
const tierFor = (m: number) => {
  if (m < 2) return 'text-sky-400 bg-sky-500/10 ring-1 ring-inset ring-sky-500/20';
  if (m < 10) return 'text-purple-400 bg-purple-500/10 ring-1 ring-inset ring-purple-500/20';
  return 'text-pink-400 bg-pink-500/10 ring-1 ring-inset ring-pink-500/20';
};

const HistoryBar = () => {
  const crashHistory = useGameStore((s) => s.crashHistory);

  if (!crashHistory || crashHistory.length === 0) return null;

  const items = [...crashHistory].reverse();

  return (
    <div className="relative flex items-center bg-[#0e0e10] px-3 py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {items.map((m, i) => (
          <span
            key={i}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-xs font-bold ${tierFor(m)}`}
          >
            {m.toFixed(2)}×
          </span>
        ))}
      </div>

      {/* Fade-out so pills slide under the pinned button on the right */}
      <div className="pointer-events-none absolute right-12 top-0 h-full w-10 bg-gradient-to-l from-[#0e0e10] to-transparent" />

      <button
        className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1b1c1d] text-xs text-gray-400 ring-1 ring-inset ring-white/5 transition-colors hover:text-gray-200"
        title="Round history"
        aria-label="Round history"
      >
        🕐
      </button>
    </div>
  );
};

export default HistoryBar;
