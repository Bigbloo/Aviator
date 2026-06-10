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
  sessionSeed: string;
  lossStreak: number;
  revengeAvailable: boolean;
  maxBetSuggestion: number | null;

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
  setSessionSeed: (seed: string) => void;
  registerResult: (r: { result: 'won' | 'lost'; payout: number }) => void;
  consumeRevenge: () => void;
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
  sessionSeed: '',
  lossStreak: 0,
  revengeAvailable: false,
  maxBetSuggestion: null,

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
  setSessionSeed: (seed) => set({ sessionSeed: seed }),
  registerResult: (r) =>
    set((state) => {
      if (r.result === 'lost') {
        const nextLossStreak = state.lossStreak + 1;
        return {
          lastResult: r,
          lossStreak: nextLossStreak,
          revengeAvailable: true,
          maxBetSuggestion:
            nextLossStreak >= 3 ? Number(state.balance.toFixed(2)) : null,
        };
      }
      return {
        lastResult: r,
        lossStreak: 0,
        revengeAvailable: false,
        maxBetSuggestion: null,
      };
    }),
  consumeRevenge: () => set({ revengeAvailable: false }),
  resetRound: () =>
    set({
      phase: 'waiting',
      roundId: null,
      currentMultiplier: 1.0,
      crashPoint: null,
      hasBet: false,
      cashedOut: false,
      // Keep lastResult visible until next bet is placed
    }),
}));
