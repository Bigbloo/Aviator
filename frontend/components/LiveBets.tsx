/**
 * LiveBets.tsx
 * "All Bets" sidebar: tabs (All Bets / My Bets), a live count, and a table of
 * bets. All Bets = the live round feed; My Bets = the player's own bet history.
 */

'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/store/gameStore';
import { getMyBets, type MyBet } from '@/lib/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface BetRow {
  key: string;
  name: string;
  amount: number;
  multiplier: number | null;
  payout: number;
  status: 'flying' | 'won' | 'lost';
}

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

const fmtTime = (s: number) =>
  new Date(s * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const LiveBets = () => {
  const userId = useGameStore((s) => s.userId);
  const [rows, setRows] = useState<BetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [tab, setTab] = useState<'all' | 'my'>('all');

  // Live round feed (All Bets).
  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on('bets:active', (data: { roundId: string; total?: number; bets: { name: string; amount: number }[] }) => {
      setTotal(data.total ?? data.bets.length);
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
      setRows((prev) => prev.map((r) => (r.status === 'flying' ? { ...r, status: 'lost' as const } : r)));
      // Refresh the player's own history after each round settles.
      getMyBets().then(setMyBets).catch(() => {});
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Load My Bets when switching to that tab (and when the session changes),
  // then keep it fresh so pending bets show up live.
  useEffect(() => {
    if (tab !== 'my') return;
    const load = () => getMyBets().then(setMyBets).catch(() => {});
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [tab, userId]);

  const myStaked = myBets.reduce((a, b) => a + b.betAmount, 0);
  const myWon = myBets.reduce((a, b) => a + (b.status === 'won' ? b.payout ?? 0 : 0), 0);
  const myNet = myBets.reduce((a, b) => a + ((b.payout ?? 0) - (b.status === 'pending' ? 0 : b.betAmount)), 0);

  const Tab = ({ id, label }: { id: 'all' | 'my'; label: string }) => (
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
        </div>
      </div>

      {/* Count */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wide">
          {tab === 'my' ? 'My Bets' : 'All Bets'}
        </p>
        <p className="text-white text-sm font-bold tabular-nums">
          {tab === 'all' ? (total || rows.length).toLocaleString('en-US') : myBets.length}
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1 text-[10px] uppercase text-gray-500 font-bold border-b border-black/30">
        <span>{tab === 'my' ? 'Heure' : 'User'}</span>
        <span className="text-right pr-2">Bet USDT</span>
        <span className="text-right">Cash out</span>
      </div>

      {/* Rows */}
      <div className="max-h-[60vh] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto scrollbar-none">
        {tab === 'all' ? (
          <>
            {rows.length === 0 && <p className="text-gray-600 text-xs text-center py-6">En attente des paris…</p>}
            {rows.map((r) => (
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
                <span className={`text-right font-mono tabular-nums font-bold ${r.status === 'won' ? 'text-green-400' : 'text-gray-600'}`}>
                  {r.status === 'won' ? r.payout.toFixed(2) : '—'}
                </span>
              </div>
            ))}
          </>
        ) : (
          <>
            {myBets.length === 0 && (
              <p className="text-gray-600 text-xs text-center py-6 px-3">Aucun pari pour l’instant — place ta première mise !</p>
            )}
            {myBets.length > 0 && (
              <div className="grid grid-cols-3 gap-1 px-3 py-2 border-b border-black/30 text-center bg-[#161717]">
                <div>
                  <p className="text-[9px] uppercase text-gray-500">Misé</p>
                  <p className="text-xs font-bold text-gray-300 tabular-nums">{myStaked.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase text-gray-500">Gagné</p>
                  <p className="text-xs font-bold text-emerald-400 tabular-nums">{myWon.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase text-gray-500">Net</p>
                  <p className={`text-xs font-bold tabular-nums ${myNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {myNet >= 0 ? '+' : ''}{myNet.toFixed(2)}
                  </p>
                </div>
              </div>
            )}
            {myBets.map((b) => {
              const won = b.status === 'won';
              const lost = b.status === 'lost';
              return (
                <div
                  key={b.id}
                  className={`grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-1.5 text-xs border-b border-black/20 ${
                    won ? 'bg-green-900/15' : lost ? 'bg-red-900/10' : ''
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0 text-gray-400">
                    <span className="text-sm">{won ? '🟢' : lost ? '🔴' : '🕐'}</span>
                    <span className="flex flex-col leading-tight min-w-0">
                      <span className="truncate">{fmtTime(b.createdAt)}</span>
                      {b.crashPoint != null && (
                        <span className="text-[9px] text-gray-600">crash {b.crashPoint.toFixed(2)}×</span>
                      )}
                    </span>
                  </span>
                  <span className="text-right text-gray-300 font-mono tabular-nums pr-2 flex items-center justify-end gap-1.5">
                    {b.betAmount.toFixed(2)}
                    {b.multiplier && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${multBadge(b.multiplier)}`}>
                        {b.multiplier.toFixed(2)}×
                      </span>
                    )}
                  </span>
                  <span className={`text-right font-mono tabular-nums font-bold ${won ? 'text-green-400' : lost ? 'text-red-400' : 'text-gray-500'}`}>
                    {won ? `+${(b.payout ?? 0).toFixed(2)}` : lost ? `-${b.betAmount.toFixed(2)}` : '…'}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="px-3 py-2 border-t border-black/30 flex items-center gap-1.5">
        <span className="text-emerald-400 text-[10px]">🛡️</span>
        <span className="text-gray-500 text-[10px]">Provably Fair</span>
      </div>
    </div>
  );
};

export default LiveBets;
