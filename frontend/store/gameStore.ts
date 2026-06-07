/**
 * gameStore.ts
 * Zustand store for Aviator game state.
 * Manages: user session, balance, round state, multiplier, bets.
 */

import { create } from 'zustand';

export type GamePhase = 'waiting' | 'flying' | 'crashed';

export interface GameState {
  // User
  userId: string | null;
  balance: number;

  // Round
  phase: GamePhase;
  roundId: string | null;
  currentMultiplier: number;
  crashPoint: number | null;

  // Bet
  betAmount: number;
  hasBet: boolean;
  cashedOut: boolean;
  lastResult: { result: 'won' | 'lost'; payout: number } | null;

  // Actions
  setUserId: (id: string) => void;
  setBalance: (balance: number) => void;
  setPhase: (phase: GamePhase) => void;
  setRoundId: (id: string) => void;
  setMultiplier: (m: number) => void;
  setCrashPoint: (cp: number) => void;
  setBetAmount: (amount: number) => void;
  setHasBet: (v: boolean) => void;
  setCashedOut: (v: boolean) => void;
  setLastResult: (r: { result: 'won' | 'lost'; payout: number } | null) => void;
  resetRound: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  userId: null,
  balance: 0,
  phase: 'waiting',
  roundId: null,
  currentMultiplier: 1.0,
  crashPoint: null,
  betAmount: 10,
  hasBet: false,
  cashedOut: false,
  lastResult: null,

  setUserId: (id) => set({ userId: id }),
  setBalance: (balance) => set({ balance }),
  setPhase: (phase) => set({ phase }),
  setRoundId: (id) => set({ roundId: id }),
  setMultiplier: (m) => set({ currentMultiplier: m }),
  setCrashPoint: (cp) => set({ crashPoint: cp }),
  setBetAmount: (amount) => set({ betAmount: amount }),
  setHasBet: (v) => set({ hasBet: v }),
  setCashedOut: (v) => set({ cashedOut: v }),
  setLastResult: (r) => set({ lastResult: r }),
  resetRound: () =>
    set({
      phase: 'waiting',
      currentMultiplier: 1.0,
      crashPoint: null,
      hasBet: false,
      cashedOut: false,
      lastResult: null,
    }),
}));
