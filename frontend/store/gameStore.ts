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
  // Provably Fair: SHA256(serverSeed) committed before the round
  fairHash: string | null;

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
  setFairHash: (h: string | null) => void;
  setBetAmount: (amount: number) => void;
  setHasBet: (v: boolean) => void;
  setCashedOut: (v: boolean) => void;
  setLastResult: (r: { result: 'won' | 'lost'; payout: number } | null) => void;
  // Win/loss popup. `ts` is the first-fire time of the current burst so that
  // near-simultaneous results (e.g. both slots of a double bet) coalesce into a
  // single net figure instead of overwriting each other.
  result: { id: number; won: boolean; amount: number; ts: number } | null;
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
  fairHash: null,
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
  setFairHash: (h) => set({ fairHash: h }),
  setBetAmount: (amount) => set({ betAmount: amount }),
  setHasBet: (v) => set({ hasBet: v }),
  setCashedOut: (v) => set({ cashedOut: v }),
  setLastResult: (r) => set({ lastResult: r }),
  showResult: (won, amount) =>
    set((state) => {
      const now = Date.now();
      const prev = state.result;
      // Coalesce results fired within the same round resolution (~500ms): sum
      // signed amounts so a double bet shows the net outcome of both slots.
      if (prev && now - prev.ts < 500) {
        const net = (prev.won ? prev.amount : -prev.amount) + (won ? amount : -amount);
        return { result: { id: now + Math.random(), won: net >= 0, amount: Math.abs(net), ts: prev.ts } };
      }
      return { result: { id: now + Math.random(), won, amount, ts: now } };
    }),
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
