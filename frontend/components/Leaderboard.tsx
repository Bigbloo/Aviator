/**
 * Leaderboard.tsx
 * Top-players ranking by net profit (#8). Polls the backend every 15s.
 * Demo-padded so it's never empty.
 */

'use client';

import { useEffect, useState } from 'react';
import { getLeaderboard, type LeaderboardEntry } from '@/lib/api';

const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`);

const Leaderboard = () => {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await getLeaderboard();
        if (alive) setRows(data);
      } catch {
        /* keep previous rows on error */
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="bg-gray-900 border border-orange-900/40 rounded-xl p-4">
      <h3 className="text-white font-bold text-base mb-3 flex items-center gap-2">
        🏆 Classement
        <span className="text-[10px] text-gray-500 font-normal">(gains nets)</span>
      </h3>
      <div className="space-y-1">
        {rows.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-2">Chargement…</p>
        )}
        {rows.map((r) => (
          <div
            key={`${r.rank}-${r.name}`}
            className={`flex items-center justify-between text-sm px-2 py-1.5 rounded-md ${
              r.real ? 'bg-orange-500/10' : ''
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-6 shrink-0 text-gray-400">{medal(r.rank)}</span>
              <span className="text-gray-200 truncate">{r.name}</span>
              {r.real && <span className="text-[9px] text-orange-400">●</span>}
            </span>
            <span className={`font-bold shrink-0 ${r.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {r.net >= 0 ? '+' : ''}
              {r.net.toFixed(2)} €
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
