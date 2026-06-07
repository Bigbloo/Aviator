/**
 * socketContext.tsx
 * Provides a single Socket.IO connection + cashout helper to the whole app.
 * Wrap the app with <SocketProvider> once; consume with useSocketContext().
 */

'use client';

import { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/store/gameStore';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const BASE_URL   = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface SocketContextValue {
  cashout: (payload: {
    userId: string;
    roundId: string;
    betAmount: number;
    multiplierAtCashout: number;
  }) => Promise<{ result?: string; payout?: number; balance?: number; error?: string }>;
}

const SocketContext = createContext<SocketContextValue>({
  cashout: async () => ({ error: 'SocketProvider not mounted' }),
});

export const useSocketContext = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    // ── game:state — initial sync on connect ──────────────────────────────────
    socket.on('game:state', (data: {
      phase: string;
      roundId: string | null;
      currentMultiplier: number;
    }) => {
      const { setPhase, setRoundId, setMultiplier } = useGameStore.getState();
      setPhase(data.phase as any);
      if (data.roundId) {
        setRoundId(data.roundId);
        socket.emit('join:round', data.roundId);
      }
      setMultiplier(data.currentMultiplier ?? 1.0);
    });

    // ── round:start ───────────────────────────────────────────────────────────
    socket.on('round:start', (data: { roundId: string; startTime: number }) => {
      const { resetRound, setRoundId, setPhase, setMultiplier } = useGameStore.getState();
      resetRound();
      setRoundId(data.roundId);
      setPhase('flying');
      setMultiplier(1.0);
      socket.emit('join:round', data.roundId);
    });

    // ── multiplier:update — 50ms tick ─────────────────────────────────────────
    socket.on('multiplier:update', (data: { roundId: string; multiplier: number }) => {
      useGameStore.getState().setMultiplier(data.multiplier);
    });

    // ── round:tick — legacy fallback ──────────────────────────────────────────
    socket.on('round:tick', (data: { roundId: string; multiplier: number }) => {
      useGameStore.getState().setMultiplier(data.multiplier);
    });

    // ── round:crash ───────────────────────────────────────────────────────────
    socket.on('round:crash', (data: { roundId: string; crashPoint: number }) => {
      const { setPhase, setCrashPoint, setMultiplier } = useGameStore.getState();
      setPhase('crashed');
      setCrashPoint(data.crashPoint);
      setMultiplier(data.crashPoint);
    });

    // ── Reconnection: re-fetch current round ──────────────────────────────────
    socket.on('connect', async () => {
      console.log('[Socket] Connected:', socket.id);
      try {
        const res  = await fetch(`${BASE_URL}/api/round/current`);
        const data = await res.json();
        const { setPhase, setRoundId, setMultiplier } = useGameStore.getState();
        setPhase(data.phase as any);
        if (data.roundId) {
          setRoundId(data.roundId);
          socket.emit('join:round', data.roundId);
        }
        if (data.phase === 'waiting') setMultiplier(1.0);
      } catch {
        console.warn('[Socket] Could not fetch current round on reconnect');
      }
    });

    socket.on('disconnect', () => console.log('[Socket] Disconnected'));
    socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

    return () => { socket.disconnect(); };
  }, []);

  const cashout = useCallback(
    (payload: {
      userId: string;
      roundId: string;
      betAmount: number;
      multiplierAtCashout: number;
    }): Promise<{ result?: string; payout?: number; balance?: number; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current?.connected) {
          resolve({ error: 'Socket not connected' });
          return;
        }
        socketRef.current.emit('cashout', payload, (ack: any) => {
          resolve(ack || { error: 'No acknowledgement from server' });
        });
      });
    },
    []
  );

  return (
    <SocketContext.Provider value={{ cashout }}>
      {children}
    </SocketContext.Provider>
  );
};
