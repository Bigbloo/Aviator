/**
 * LiveBets.tsx
 * Spribe-style "All Bets" sidebar: tabs (All Bets / My Bets / Top), a live
 * count, and a table of bets with avatar, bet (USDT), multiplier and cash-out.
 */

'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/store/gameStore';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface BetRow {
  key: string;
  name: string;
  amount: number;
  multiplier: number | null;
  payout: number;
  status: 'flying' | 'won' | 'lost';
}

// Deterministic avatar color from a name.
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

const multBadge = (m: number) => {
  if (m < 2) return 'text-sky-300 bg-sky-500/15';
  if (m < 10) return 'text-purple-300 bg-purple-500/15';
  return 'text-pink-300 bg-pink-500/15';
};

const LiveBets = () => {
  const username = useGameStore((s) => s.username);
  const [rows, setRows] = useState<BetRow[]>([]);
  const [tab, setTab] = useState<'all' | 'my' | 'top'>('all');

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on('bets:active', (data: { roundId: string; bets: { name: string; amount: number }[] }) => {
      setRows(
        data.bets.map((b, i) => ({
          key: `${data.roundId}-${i}-${b.name}`,
          name: b.name,
          amount: b.amount,
          multiplier: null,
          payout: 0,
          status: 'flying' as const,
        }))
      );
    });

    socket.on('bet:cashout', (data: { name: string; multiplier: number; payout: number }) => {
      setRows((prev) => {
        const i = prev.findIndex((b) => b.name === data.name && b.status === 'flying');
        if (i === -1) return prev;
        const copy = [...prev];
        copy[i] = { ...copy[i], multiplier: data.multiplier, payout: data.payout, status: 'won' };
        return copy;
      });
    });

    socket.on('bets:results', () => {
      setRows((prev) =>
        prev.map((r) => (r.status === 'flying' ? { ...r, status: 'lost' as const } : r))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const filtered = (() => {
    if (tab === 'my') return rows.filter((r) => username && r.name === username);
    if (tab === 'top') return [...rows].sort((a, b) => b.payout - a.payout || b.amount - a.amount);
    return rows;
  })();

  const Tab = ({ id, label }: { id: 'all' | 'my' | 'top'; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 py-1.5 rounded-full text-xs font-bold transition ${
        tab === id ? 'bg-[#3a3b3e] text-white' : 'text-gray-400'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-[#1b1c1d] rounded-2xl border border-black/30 overflow-hidden flex flex-col lg:h-full">
      {/* Tabs */}
      <div className="p-2 border-b border-black/30">
        <div className="flex bg-[#101112] rounded-full p-0.5">
          <Tab id="all" label="All Bets" />
          <Tab id="my" label="My Bets" />
          <Tab id="top" label="Top" />
        </div>
      </div>

      {/* Count + header */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wide">
          {tab === 'my' ? 'My Bets' : tab === 'top' ? 'Top' : 'All Bets'}
        </p>
        <p className="text-white text-sm font-bold tabular-nums">{filtered.length}</p>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1 text-[10px] uppercase text-gray-500 font-bold border-b border-black/30">
        <span>User</span>
        <span className="text-right pr-2">Bet USDT</span>
        <span className="text-right">Cash out</span>
      </div>

      {/* Rows */}
      <div className="max-h-[60vh] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto scrollbar-none">
        {filtered.length === 0 && (
          <p className="text-gray-600 text-xs text-center py-6">En attente des paris…</p>
        )}
        {filtered.map((r) => (
          <div
            key={r.key}
            className={`grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-1.5 text-xs border-b border-black/20 ${
              r.status === 'won' ? 'bg-green-900/15' : ''
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${colorFor(r.name)} shrink-0 flex items-center justify-center text-[10px] font-bold text-white`}>
                {r.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-gray-300 truncate">{r.name}</span>
            </span>
            <span className="text-right text-gray-300 font-mono tabular-nums pr-2 flex items-center justify-end gap-1.5">
              {r.amount.toFixed(2)}
              {r.multiplier && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${multBadge(r.multiplier)}`}>
                  {r.multiplier.toFixed(2)}×
                </span>
              )}
            </span>
            <span
              className={`text-right font-mono tabular-nums font-bold ${
                r.status === 'won' ? 'text-green-400' : 'text-gray-600'
              }`}
            >
              {r.status === 'won' ? r.payout.toFixed(2) : '—'}
            </span>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-black/30 flex items-center gap-1.5">
        <span className="text-emerald-400 text-[10px]">🛡️</span>
        <span className="text-gray-500 text-[10px]">Provably Fair</span>
      </div>
    </div>
  );
};

export default LiveBets;
