/**
 * useSocket.ts
 * Custom hook for Socket.IO connection to the Aviator backend.
 * Handles reconnection and game event dispatching to Zustand store.
 */

'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/store/gameStore';
import { getBalance } from '@/lib/api';
import { playTakeoff, playCrash } from '@/lib/sound';

// Socket.IO needs the HTTP(S) origin, NOT ws://. The client upgrades internally.
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const {
    setPhase,
    setRoundId,
    setMultiplier,
    setCrashPoint,
    setCrashHistory,
    setFairHash,
    resetRound,
  } = useGameStore();

  useEffect(() => {
    // Connect to backend Socket.IO
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // WS first, fallback to polling
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Current game state on connect
    socket.on('game:state', (data: { phase: string; roundId: string; currentMultiplier: number; seedHash?: string | null }) => {
      setPhase(data.phase as any);
      if (data.roundId) setRoundId(data.roundId);
      setMultiplier(data.currentMultiplier);
      if (data.seedHash) setFairHash(data.seedHash);
    });

    // Betting window opens — players can place bets now
    socket.on('round:betting', (data: { roundId: string; bettingMs: number; seedHash?: string }) => {
      resetRound();
      setRoundId(data.roundId);
      setPhase('betting');
      setMultiplier(1.0);
      setFairHash(data.seedHash || null);
      // expose betting deadline + total window for the countdown gauge (canvas)
      (window as any).__bettingMs = data.bettingMs || 0;
      (window as any).__bettingEndsAt = Date.now() + (data.bettingMs || 0);
    });

    // Plane takes off — multiplier starts climbing (cashout phase)
    socket.on('round:start', (data: { roundId: string; startedAt: number }) => {
      setRoundId(data.roundId);
      setPhase('flying');
      setMultiplier(1.0);
      playTakeoff();
    });

    // Multiplier tick
    socket.on('round:tick', (data: { roundId: string; multiplier: number }) => {
      setMultiplier(data.multiplier);
    });

    // Round crashed — resync balance from server (handles lost bets correctly)
    socket.on('round:crash', async (data: { roundId: string; crashPoint: number }) => {
      setPhase('crashed');
      setCrashPoint(data.crashPoint);
      setMultiplier(data.crashPoint);
      playCrash();

      // Resync the real balance from the server (source of truth).
      // Each BetPanel tracks its own win/lost state via the phase change.
      //
      // Skipped while the page is hidden: rounds keep crashing every 10-20s
      // whether or not anyone is watching, so this was firing an authenticated
      // request per round, forever, from every backgrounded tab. The listener
      // below refetches once on return, so the figure is still correct when the
      // player actually looks at it.
      if (typeof document !== 'undefined' && document.hidden) return;
      const s = useGameStore.getState();
      if (s.userId) {
        try {
          const { balance } = await getBalance();
          s.setBalance(balance);
        } catch {
          /* keep local balance if fetch fails */
        }
      }
    });

    // Crash history bar update
    socket.on('history:update', (data: { history: number[] }) => {
      setCrashHistory(data.history || []);
    });

    socket.on('connect', () => console.log('[Socket] Connected'));
    socket.on('disconnect', () => console.log('[Socket] Disconnected'));
    socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

    // Coming back to the page: pull the balance once, covering every round
    // whose refetch was skipped while hidden.
    const onVisible = async () => {
      if (document.hidden) return;
      const s = useGameStore.getState();
      if (!s.userId) return;
      try {
        const { balance } = await getBalance();
        s.setBalance(balance);
      } catch {
        /* keep local balance if fetch fails */
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      socket.disconnect();
    };
  }, []);

  return socketRef;
};
