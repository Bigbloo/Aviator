/**
 * LiveBets.tsx
 * Real-time table of bets for the current round + recent results.
 * Listens to:
 *  - bets:active   → players who placed a bet this round (status: flying)
 *  - bet:cashout   → a player cashed out live (status: won)
 *  - bets:results  → round ended; losers finalized, archive to history
 */

'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ActiveBet {
  name: string;
  amount: number;
  multiplier: number | null;
  payout: number;
  status: 'flying' | 'won' | 'lost';
}

interface HistoryRow {
  id: string;
  name: string;
  amount: number;
  multiplier: number | null;
  payout: number;
  result: 'won' | 'lost';
}

const LiveBets = () => {
  const [active, setActive] = useState<ActiveBet[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    // New round: reset the active table with the round's bets (status flying)
    socket.on('bets:active', (data: { roundId: string; bets: { name: string; amount: number }[] }) => {
      setActive(
        data.bets.map((b) => ({ name: b.name, amount: b.amount, multiplier: null, payout: 0, status: 'flying' }))
      );
    });

    // A player cashed out live → mark them as won in the active table
    socket.on('bet:cashout', (data: { name: string; multiplier: number; payout: number }) => {
      setActive((prev) => {
        const i = prev.findIndex((b) => b.name === data.name && b.status === 'flying');
        if (i === -1) return prev;
        const copy = [...prev];
        copy[i] = { ...copy[i], multiplier: data.multiplier, payout: data.payout, status: 'won' };
        return copy;
      });
    });

    // Round ended → finalize losers, push the round to recent history
    socket.on('bets:results', (data: { roundId: string; results: any[] }) => {
      const rows: HistoryRow[] = data.results.map((r, i) => ({
        id: `${data.roundId}-${i}`,
        name: r.name,
        amount: r.amount,
        multiplier: r.multiplier,
        payout: r.payout,
        result: r.result,
      }));
      setHistory((prev) => [...rows, ...prev].slice(0, 40));
      setActive([]); // clear active; next round repopulates
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const Row = ({ name, amount, multiplier, payout, status }: ActiveBet) => (
    <div
      className={`grid grid-cols-4 gap-2 items-center px-2 py-2 text-xs ${
        status === 'won' ? 'bg-green-900/15' : status === 'lost' ? 'bg-red-900/10' : ''
      }`}
    >
      <span className="text-gray-300 truncate flex items-center gap-1">
        <span className="text-base">
          {status === 'won' ? '🟢' : status === 'lost' ? '🔴' : '🕐'}
        </span>
        <span className="truncate">{name}</span>
      </span>
      <span className="text-right text-gray-400 font-mono">{amount.toFixed(2)}€</span>
      <span className="text-right font-mono">
        {multiplier ? <span className="text-orange-400">×{multiplier.toFixed(2)}</span> : <span className="text-gray-600">—</span>}
      </span>
      <span
        className={`text-right font-mono font-bold ${
          status === 'won' ? 'text-green-400' : status === 'lost' ? 'text-red-400' : 'text-gray-500'
        }`}
      >
        {status === 'won' ? `+${payout.toFixed(2)}€` : status === 'lost' ? `-${amount.toFixed(2)}€` : '...'}
      </span>
    </div>
  );

  const hasContent = active.length > 0 || history.length > 0;

  return (
    <div className="bg-gray-900 border border-orange-900/40 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">📊 Paris en direct</h3>
        <span className="flex items-center gap-1.5 text-[10px] text-green-400 font-bold">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          LIVE
        </span>
      </div>

      {!hasContent ? (
        <p className="text-gray-500 text-xs text-center py-6">En attente de la prochaine manche...</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wide text-gray-500 font-bold px-2 pb-2 border-b border-gray-800">
            <span>Joueur</span>
            <span className="text-right">Mise</span>
            <span className="text-right">Cote</span>
            <span className="text-right">Gain</span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-800/60">
            {/* Current round bets (live) first */}
            {active.map((b, i) => (
              <Row key={`a-${i}`} {...b} />
            ))}
            {/* Then recent finished results */}
            {history.map((r) => (
              <Row
                key={r.id}
                name={r.name}
                amount={r.amount}
                multiplier={r.multiplier}
                payout={r.payout}
                status={r.result}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveBets;
