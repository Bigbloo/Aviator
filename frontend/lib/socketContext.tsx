/**
 * socketContext.tsx
 * Provides a single Socket.IO connection + cashout helper to the whole app.
 *
 * Features:
 *  - Tension level propagation (0-1) pour le stress visuel
 *  - serverSeed propagation pour le seed individualisé
 *  - Retour haptique adaptatif (vibrations corrélées à la tension)
 *  - Stimulation auditive subliminale (oscillateur à fréquence optimisée)
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

// ── Retour haptique adaptatif ─────────────────────────────────────────────────
/**
 * Déclenche une vibration dont l'intensité est corrélée au niveau de tension.
 * tensionLevel 0-1 → durée de vibration 0-80ms
 */
const triggerHaptic = (tensionLevel: number) => {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  if (tensionLevel < 0.3) return; // pas de vibration en dessous de 30% de tension

  // Intensité variable : plus la tension est haute, plus la vibration est longue
  const duration = Math.round(tensionLevel * 80); // 0-80ms
  const pattern = tensionLevel > 0.8
    ? [duration, 30, duration] // double vibration si très haute tension
    : [duration];
  navigator.vibrate(pattern);
};

// ── Stimulation auditive subliminale ──────────────────────────────────────────
/**
 * Oscillateur audio à fréquence optimisée pour accélérer le temps de réaction.
 * Fréquence de base : 40Hz (gamma bas) — corrélée à l'attention et la réactivité.
 * Monte progressivement avec la tension jusqu'à 80Hz.
 */
class AviatorAudioEngine {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private running = false;

  start() {
    if (this.running || typeof window === 'undefined') return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.oscillator = this.ctx.createOscillator();
      this.gainNode = this.ctx.createGain();

      this.oscillator.type = 'sine';
      this.oscillator.frequency.setValueAtTime(40, this.ctx.currentTime); // 40Hz gamma
      this.gainNode.gain.setValueAtTime(0.03, this.ctx.currentTime); // très bas — subliminal

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);
      this.oscillator.start();
      this.running = true;
    } catch {
      // AudioContext non disponible (SSR ou permissions)
    }
  }

  updateTension(tensionLevel: number) {
    if (!this.running || !this.oscillator || !this.gainNode || !this.ctx) return;
    // Fréquence : 40Hz (repos) → 80Hz (tension max)
    const freq = 40 + tensionLevel * 40;
    // Volume : très bas mais monte légèrement avec la tension
    const gain = 0.02 + tensionLevel * 0.04;
    this.oscillator.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
    this.gainNode.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);
  }

  stop() {
    if (!this.running) return;
    try {
      this.oscillator?.stop();
      this.ctx?.close();
    } catch {}
    this.running = false;
    this.oscillator = null;
    this.gainNode = null;
    this.ctx = null;
  }

  crash() {
    if (!this.running || !this.gainNode || !this.ctx) return;
    // Fade out rapide au crash
    this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    setTimeout(() => this.stop(), 300);
  }
}

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const socketRef = useRef<Socket | null>(null);
  const audioRef  = useRef<AviatorAudioEngine>(new AviatorAudioEngine());
  const hapticTickRef = useRef<number>(0); // throttle haptique

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    // ── game:state — sync initial au connect ──────────────────────────────────
    socket.on('game:state', (data: {
      phase: string;
      roundId: string | null;
      currentMultiplier: number;
      serverSeed?: string;
    }) => {
      const { setPhase, setRoundId, setMultiplier, setServerSeed } = useGameStore.getState();
      setPhase(data.phase as any);
      if (data.roundId) {
        setRoundId(data.roundId);
        socket.emit('join:round', data.roundId);
      }
      setMultiplier(data.currentMultiplier ?? 1.0);
      if (data.serverSeed) setServerSeed(data.serverSeed);
    });

    // ── round:start ───────────────────────────────────────────────────────────
    socket.on('round:start', (data: { roundId: string; startTime: number; serverSeed?: string }) => {
      const { resetRound, setRoundId, setPhase, setMultiplier, setServerSeed } = useGameStore.getState();
      resetRound();
      setRoundId(data.roundId);
      setPhase('flying');
      setMultiplier(1.0);
      if (data.serverSeed) setServerSeed(data.serverSeed);
      socket.emit('join:round', data.roundId);
      // Démarrer l'audio subliminal au début du round
      audioRef.current.start();
    });

    // ── multiplier:update — tick 50ms ─────────────────────────────────────────
    socket.on('multiplier:update', (data: { roundId: string; multiplier: number; tensionLevel?: number }) => {
      const { setMultiplier, setTensionLevel } = useGameStore.getState();
      setMultiplier(data.multiplier);

      const tension = data.tensionLevel ?? 0;
      setTensionLevel(tension);

      // Mettre à jour l'audio avec la tension
      audioRef.current.updateTension(tension);

      // Retour haptique adaptatif — throttlé à 1 vibration / 500ms max
      hapticTickRef.current += 1;
      if (hapticTickRef.current % 10 === 0) { // toutes les 10 ticks = 500ms
        triggerHaptic(tension);
      }
    });

    // ── round:tick — legacy fallback ──────────────────────────────────────────
    socket.on('round:tick', (data: { roundId: string; multiplier: number }) => {
      useGameStore.getState().setMultiplier(data.multiplier);
    });

    // ── round:crash ───────────────────────────────────────────────────────────
    socket.on('round:crash', (data: { roundId: string; crashPoint: number }) => {
      const { setPhase, setCrashPoint, setMultiplier, setTensionLevel } = useGameStore.getState();
      setPhase('crashed');
      setCrashPoint(data.crashPoint);
      setMultiplier(data.crashPoint);
      setTensionLevel(0);
      hapticTickRef.current = 0;
      // Vibration de crash — forte et courte
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
      }
      // Arrêter l'audio
      audioRef.current.crash();
    });

    // ── Reconnection ──────────────────────────────────────────────────────────
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

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      audioRef.current.stop();
    });
    socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

    return () => {
      socket.disconnect();
      audioRef.current.stop();
    };
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
