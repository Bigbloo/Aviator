/**
 * useSocket.ts
 * Custom hook for Socket.IO connection to the Aviator backend.
 * Handles reconnection and game event dispatching to Zustand store.
 */

'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/store/gameStore';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Read store actions once — they are stable references from Zustand
    const { setPhase, setRoundId, setMultiplier, setCrashPoint, resetRound } =
      useGameStore.getState();

    // Connect to backend Socket.IO
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Current game state on connect — sync immediately
    socket.on(
      'game:state',
      (data: { phase: string; roundId: string | null; currentMultiplier: number }) => {
        const { setPhase, setRoundId, setMultiplier } = useGameStore.getState();
        setPhase(data.phase as any);
        if (data.roundId) setRoundId(data.roundId);
        setMultiplier(data.currentMultiplier ?? 1.0);
      }
    );

    // New round started
    socket.on('round:start', (data: { roundId: string; startedAt: number }) => {
      const { resetRound, setRoundId, setPhase, setMultiplier } = useGameStore.getState();
      resetRound();
      setRoundId(data.roundId);
      setPhase('flying');
      setMultiplier(1.0);
    });

    // Multiplier tick
    socket.on('round:tick', (data: { roundId: string; multiplier: number }) => {
      useGameStore.getState().setMultiplier(data.multiplier);
    });

    // Round crashed
    socket.on('round:crash', (data: { roundId: string; crashPoint: number }) => {
      const { setPhase, setCrashPoint, setMultiplier } = useGameStore.getState();
      setPhase('crashed');
      setCrashPoint(data.crashPoint);
      setMultiplier(data.crashPoint);
    });

    socket.on('connect', () => console.log('[Socket] Connected:', socket.id));
    socket.on('disconnect', () => console.log('[Socket] Disconnected'));
    socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

    return () => {
      socket.disconnect();
    };
  }, []); // Only run once on mount

  return socketRef;
};
