/**
 * TopWinners.tsx
 * Right-hand panel (replaces the chat on the web layout). Shows the biggest
 * winners by net profit, polled from the backend leaderboard. Amounts in USDT.
 */

'use client';

import { useEffect, useState } from 'react';
import { getLeaderboard, type LeaderboardEntry } from '@/lib/api';

const AVATAR_COLORS = [
  'from-pink-500 to-rose-600', 'from-sky-500 to-blue-600', 'from-emerald-500 to-green-600',
  'from-amber-500 to-orange-600', 'from-violet-500 to-purple-600', 'from-cyan-500 to-teal-600',
  'from-red-500 to-pink-600', 'from-indigo-500 to-blue-700',
];
const colorFor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};
const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`);

const TopWinners = () => {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await getLeaderboard();
        if (alive) setRows(data);
      } catch {
        /* keep previous */
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
    <div className="bg-[#1b1c1d] rounded-2xl border border-black/30 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-black/30 flex items-center justify-between">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">🏆 Top Winners</h3>
        <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          LIVE
        </span>
      </div>

      <div className="overflow-y-auto scrollbar-none lg:max-h-[calc(100vh-180px)]">
        {rows.length === 0 && <p className="text-gray-600 text-sm text-center py-8">Chargement…</p>}
        {rows.map((r) => (
          <div
            key={`${r.rank}-${r.name}`}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-black/20 hover:bg-[#212224] transition"
          >
            <span className="w-5 text-center text-xs font-bold text-gray-400 shrink-0">{medal(r.rank)}</span>
            <span className={`relative w-9 h-9 rounded-full bg-gradient-to-br ${colorFor(r.name)} shrink-0 flex items-center justify-center text-sm font-bold text-white`}>
              {r.name.charAt(0).toUpperCase()}
              {r.rank <= 3 && (
                <span className="absolute -bottom-1 -right-1 text-xs">{medal(r.rank)}</span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-gray-200 text-sm font-semibold truncate">{r.name}</p>
              <p className="text-gray-500 text-[10px]">{r.rounds > 0 ? `${r.rounds} manches` : 'Joueur vedette'}</p>
            </div>
            <span className={`text-sm font-bold tabular-nums shrink-0 ${r.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {r.net >= 0 ? '+' : ''}
              {r.net.toFixed(2)}
              <span className="text-[10px] text-gray-500 ml-1">USDT</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopWinners;
