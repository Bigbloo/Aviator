/**
 * LiveBets.tsx
 * Real-time table of wins/losses for each round.
 * Listens to the `bets:results` Socket.IO event (real player bets + demo bots).
 */

'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface BetResult {
  name: string;
  amount: number;
  multiplier: number | null;
  payout: number;
  result: 'won' | 'lost';
}

interface Row extends BetResult {
  id: string;
  crashPoint: number;
}

const LiveBets = () => {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on(
      'bets:results',
      (data: { roundId: string; crashPoint: number; results: BetResult[] }) => {
        const newRows: Row[] = data.results.map((r, i) => ({
          ...r,
          id: `${data.roundId}-${i}-${Date.now()}`,
          crashPoint: data.crashPoint,
        }));
        // Prepend newest, keep last 40
        setRows((prev) => [...newRows, ...prev].slice(0, 40));
      }
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="bg-gray-900 border border-orange-900/40 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          📊 Gains &amp; pertes en direct
        </h3>
        <span className="flex items-center gap-1.5 text-[10px] text-green-400 font-bold">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          LIVE
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-6">
          En attente des résultats de la prochaine manche...
        </p>
      ) : (
        <div className="overflow-x-auto">
          {/* Header row */}
          <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wide text-gray-500 font-bold px-2 pb-2 border-b border-gray-800">
            <span>Joueur</span>
            <span className="text-right">Mise</span>
            <span className="text-right">Cote</span>
            <span className="text-right">Gain</span>
          </div>

          {/* Data rows */}
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-800/60">
            {rows.map((r) => (
              <div
                key={r.id}
                className={`grid grid-cols-4 gap-2 items-center px-2 py-2 text-xs ${
                  r.result === 'won' ? 'bg-green-900/10' : ''
                }`}
              >
                <span className="text-gray-300 truncate flex items-center gap-1">
                  <span className="text-base">{r.result === 'won' ? '🟢' : '🔴'}</span>
                  <span className="truncate">{r.name}</span>
                </span>
                <span className="text-right text-gray-400 font-mono">
                  {r.amount.toFixed(2)}€
                </span>
                <span className="text-right font-mono">
                  {r.multiplier ? (
                    <span className="text-orange-400">×{r.multiplier.toFixed(2)}</span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </span>
                <span
                  className={`text-right font-mono font-bold ${
                    r.result === 'won' ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {r.result === 'won'
                    ? `+${r.payout.toFixed(2)}€`
                    : `-${r.amount.toFixed(2)}€`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveBets;
