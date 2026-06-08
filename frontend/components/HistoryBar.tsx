/**
 * HistoryBar.tsx
 * Horizontal bar showing the last crash multipliers (like real Aviator).
 * Color-coded: blue < 2x, purple < 10x, pink/gold >= 10x.
 */

'use client';

import { useGameStore } from '@/store/gameStore';

const colorFor = (m: number) => {
  if (m < 2) return 'text-sky-400 bg-sky-400/10 border-sky-400/30';
  if (m < 10) return 'text-purple-400 bg-purple-400/10 border-purple-400/30';
  return 'text-pink-400 bg-pink-400/10 border-pink-400/30';
};

const HistoryBar = () => {
  const crashHistory = useGameStore((s) => s.crashHistory);

  if (!crashHistory || crashHistory.length === 0) return null;

  // newest first
  const items = [...crashHistory].reverse();

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-950/80 border-b border-gray-800 overflow-x-auto scrollbar-none">
      <span className="text-[10px] uppercase tracking-wide text-gray-500 font-bold shrink-0">
        Historique
      </span>
      <div className="flex items-center gap-1.5">
        {items.map((m, i) => (
          <span
            key={i}
            className={`text-xs font-bold font-mono px-2 py-1 rounded-md border whitespace-nowrap ${colorFor(m)}`}
          >
            {m.toFixed(2)}×
          </span>
        ))}
      </div>
    </div>
  );
};

export default HistoryBar;
