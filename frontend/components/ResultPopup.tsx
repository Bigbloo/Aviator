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
    <div className="fixed inset-x-0 top-1/3 z-[70] flex justify-center px-4 pointer-events-none">
      <div
        key={result.id}
        className={`font-black text-4xl sm:text-5xl tabular-nums transition-all duration-300 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        } ${won ? 'text-emerald-400' : 'text-red-500'}`}
      >
        {won ? '+' : '−'}
        {result.amount.toFixed(2)} <span className="text-2xl align-middle">USDT</span>
      </div>
    </div>
  );
};

export default ResultPopup;
