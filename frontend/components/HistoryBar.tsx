/**
 * HistoryBar.tsx
 * Spribe-style row of recent crash multipliers as rounded pills.
 * Color-coded: blue < 2x, purple < 10x, pink/gold >= 10x.
 */

'use client';

import { useGameStore } from '@/store/gameStore';

const colorFor = (m: number) => {
  if (m < 2) return 'text-sky-400';
  if (m < 10) return 'text-purple-400';
  return 'text-pink-400';
};

const HistoryBar = () => {
  const crashHistory = useGameStore((s) => s.crashHistory);

  if (!crashHistory || crashHistory.length === 0) return null;

  const items = [...crashHistory].reverse();

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#0e0e10]">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {items.map((m, i) => (
          <span
            key={i}
            className={`text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-[#1b1c1d] whitespace-nowrap ${colorFor(m)}`}
          >
            {m.toFixed(2)}×
          </span>
        ))}
      </div>
      <button
        className="ml-auto shrink-0 w-7 h-7 rounded-full bg-[#1b1c1d] text-gray-400 flex items-center justify-center text-xs"
        title="Historique"
        aria-label="Historique"
      >
        🕐
      </button>
    </div>
  );
};

export default HistoryBar;
