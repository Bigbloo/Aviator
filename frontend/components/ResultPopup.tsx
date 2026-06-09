/**
 * ResultPopup.tsx
 * Centered popup shown when the player wins or loses a bet — green "+X USDT"
 * for a win, red "-X USDT" for a loss. Auto-dismisses.
 */

'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';

const ResultPopup = () => {
  const result = useGameStore((s) => s.result);
  const clearResult = useGameStore((s) => s.clearResult);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!result) return;
    setVisible(true);
    const t1 = setTimeout(() => setVisible(false), 2200);
    const t2 = setTimeout(() => clearResult(), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [result, clearResult]);

  if (!result) return null;
  const won = result.won;

  return (
    <div className="fixed inset-x-0 top-24 z-[70] flex justify-center px-4 pointer-events-none">
      <div
        key={result.id}
        className={`rounded-2xl px-7 py-4 text-center shadow-2xl border-2 transition-all duration-300 ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 -translate-y-2'
        } ${won ? 'bg-emerald-500/95 border-emerald-300' : 'bg-red-600/95 border-red-300'}`}
      >
        <div className="text-white/90 text-[11px] font-black uppercase tracking-[0.2em]">
          {won ? '✓ Gagné' : '✕ Perdu'}
        </div>
        <div className="text-white font-black text-3xl sm:text-4xl tabular-nums leading-tight mt-0.5">
          {won ? '+' : '−'}
          {result.amount.toFixed(2)} <span className="text-lg align-middle">USDT</span>
        </div>
      </div>
    </div>
  );
};

export default ResultPopup;
