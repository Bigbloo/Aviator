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

// Socket.IO needs the HTTP(S) origin, NOT ws://. The client upgrades internally.
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const {
    setPhase,
    setRoundId,
    setMultiplier,
    setCrashPoint,
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
    socket.on('game:state', (data: { phase: string; roundId: string; currentMultiplier: number }) => {
      setPhase(data.phase as any);
      if (data.roundId) setRoundId(data.roundId);
      setMultiplier(data.currentMultiplier);
    });

    // Betting window opens — players can place bets now
    socket.on('round:betting', (data: { roundId: string; bettingMs: number }) => {
      resetRound();
      setRoundId(data.roundId);
      setPhase('betting');
      setMultiplier(1.0);
    });

    // Plane takes off — multiplier starts climbing (cashout phase)
    socket.on('round:start', (data: { roundId: string; startedAt: number }) => {
      setRoundId(data.roundId);
      setPhase('flying');
      setMultiplier(1.0);
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

      // If the player had a bet on this round and never cashed out → it's lost.
      const s = useGameStore.getState();
      if (s.hasBet && !s.cashedOut && s.roundId === data.roundId) {
        s.setLastResult({ result: 'lost', payout: 0 });
      }

      // Always resync the real balance from the server (source of truth).
      if (s.userId) {
        try {
          const { balance } = await getBalance(s.userId);
          s.setBalance(balance);
        } catch {
          /* keep local balance if fetch fails */
        }
      }
    });

    socket.on('connect', () => console.log('[Socket] Connected'));
    socket.on('disconnect', () => console.log('[Socket] Disconnected'));
    socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef;
};
