/**
 * gameStore.ts
 * Zustand store for Aviator game state.
 * Manages: user session, balance, round state, multiplier, bets,
 *          tension level, session seed, consecutive losses, revenge state.
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

  // Tension & stress visuel (0-1)
  tensionLevel: number;

  // Seed individualisé
  sessionSeed: string | null;
  serverSeed: string | null;

  // Bet
  betAmount: number;
  hasBet: boolean;
  cashedOut: boolean;
  lastResult: { result: 'won' | 'lost'; payout: number } | null;

  // Pertes consécutives & revanche
  consecutiveLosses: number;
  revengeAvailable: boolean;
  lastLostAmount: number;

  // Suggestion de mise max
  maxBetSuggestion: number | null;

  // Actions
  setUserId: (id: string) => void;
  setBalance: (balance: number) => void;
  setPhase: (phase: GamePhase) => void;
  setRoundId: (id: string) => void;
  setMultiplier: (m: number) => void;
  setTensionLevel: (t: number) => void;
  setCrashPoint: (cp: number) => void;
  setBetAmount: (amount: number) => void;
  setHasBet: (v: boolean) => void;
  setCashedOut: (v: boolean) => void;
  setLastResult: (r: { result: 'won' | 'lost'; payout: number } | null) => void;
  setSessionSeed: (seed: string) => void;
  setServerSeed: (seed: string | null) => void;
  incrementLosses: () => void;
  resetLosses: () => void;
  setRevengeAvailable: (v: boolean) => void;
  setLastLostAmount: (amount: number) => void;
  setMaxBetSuggestion: (amount: number | null) => void;
  resetRound: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  userId: null,
  balance: 0,
  phase: 'waiting',
  roundId: null,
  currentMultiplier: 1.0,
  crashPoint: null,
  tensionLevel: 0,
  sessionSeed: null,
  serverSeed: null,
  betAmount: 10,
  hasBet: false,
  cashedOut: false,
  lastResult: null,
  consecutiveLosses: 0,
  revengeAvailable: false,
  lastLostAmount: 0,
  maxBetSuggestion: null,

  setUserId: (id) => set({ userId: id }),
  setBalance: (balance) => set({ balance }),
  setPhase: (phase) => set({ phase }),
  setRoundId: (id) => set({ roundId: id }),
  setMultiplier: (m) => set({ currentMultiplier: m }),
  setTensionLevel: (t) => set({ tensionLevel: t }),
  setCrashPoint: (cp) => set({ crashPoint: cp }),
  setBetAmount: (amount) => set({ betAmount: amount }),
  setHasBet: (v) => set({ hasBet: v }),
  setCashedOut: (v) => set({ cashedOut: v }),
  setLastResult: (r) => set({ lastResult: r }),
  setSessionSeed: (seed) => set({ sessionSeed: seed }),
  setServerSeed: (seed) => set({ serverSeed: seed }),
  incrementLosses: () => set((s) => ({ consecutiveLosses: s.consecutiveLosses + 1 })),
  resetLosses: () => set({ consecutiveLosses: 0, revengeAvailable: false, maxBetSuggestion: null }),
  setRevengeAvailable: (v) => set({ revengeAvailable: v }),
  setLastLostAmount: (amount) => set({ lastLostAmount: amount }),
  setMaxBetSuggestion: (amount) => set({ maxBetSuggestion: amount }),
  resetRound: () =>
    set({
      phase: 'waiting',
      roundId: null,
      currentMultiplier: 1.0,
      crashPoint: null,
      tensionLevel: 0,
      hasBet: false,
      cashedOut: false,
    }),
}));
