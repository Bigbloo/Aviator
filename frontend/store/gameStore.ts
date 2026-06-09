/**
 * gameStore.ts
 * Zustand store for Aviator game state.
 * Manages: user session, balance, round state, multiplier, bets.
 */

import { create } from 'zustand';

export type GamePhase = 'waiting' | 'betting' | 'flying' | 'crashed';

export interface GameState {
  // User
  userId: string | null;
  username: string | null;
  balance: number;

  // Round
  phase: GamePhase;
  roundId: string | null;
  currentMultiplier: number;
  crashPoint: number | null;
  crashHistory: number[];

  // Bet
  betAmount: number;
  hasBet: boolean;
  cashedOut: boolean;
  lastResult: { result: 'won' | 'lost'; payout: number } | null;

  // Actions
  setUserId: (id: string) => void;
  setUsername: (name: string | null) => void;
  setBalance: (balance: number) => void;
  setPhase: (phase: GamePhase) => void;
  setRoundId: (id: string) => void;
  setMultiplier: (m: number) => void;
  setCrashPoint: (cp: number) => void;
  setCrashHistory: (h: number[]) => void;
  setBetAmount: (amount: number) => void;
  setHasBet: (v: boolean) => void;
  setCashedOut: (v: boolean) => void;
  setLastResult: (r: { result: 'won' | 'lost'; payout: number } | null) => void;
  // Win/loss popup
  result: { id: number; won: boolean; amount: number } | null;
  showResult: (won: boolean, amount: number) => void;
  clearResult: () => void;
  resetRound: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  userId: null,
  username: null,
  balance: 0,
  phase: 'waiting',
  roundId: null,
  currentMultiplier: 1.0,
  crashPoint: null,
  crashHistory: [],
  betAmount: 10,
  hasBet: false,
  cashedOut: false,
  lastResult: null,
  result: null,

  setUserId: (id) => set({ userId: id }),
  setUsername: (name) => set({ username: name }),
  setBalance: (balance) => set({ balance }),
  setPhase: (phase) => set({ phase }),
  setRoundId: (id) => set({ roundId: id }),
  setMultiplier: (m) => set({ currentMultiplier: m }),
  setCrashPoint: (cp) => set({ crashPoint: cp }),
  setCrashHistory: (h) => set({ crashHistory: h }),
  setBetAmount: (amount) => set({ betAmount: amount }),
  setHasBet: (v) => set({ hasBet: v }),
  setCashedOut: (v) => set({ cashedOut: v }),
  setLastResult: (r) => set({ lastResult: r }),
  showResult: (won, amount) => set({ result: { id: Date.now() + Math.random(), won, amount } }),
  clearResult: () => set({ result: null }),
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
