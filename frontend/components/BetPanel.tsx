/**
 * BetPanel.tsx
 * Bet controls for a SINGLE bet slot. Render two of these for the double-bet
 * feature (slot 1 + slot 2). Each panel owns its own local bet state
 * (amount, hasBet, cashedOut, auto-cashout) so the two are fully independent.
 * Shared game state (phase, multiplier, balance, roundId) comes from the store.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { placeBet, cashout } from '@/lib/api';
import { playCashout } from '@/lib/sound';

interface BetPanelProps {
  slot?: 1 | 2;
}

const BetPanel = ({ slot = 1 }: BetPanelProps) => {
  const {
    userId,
    balance,
    phase,
    roundId,
    currentMultiplier,
    setBalance,
  } = useGameStore();

  // Local per-slot state (independent of the other panel)
  const [betAmount, setBetAmount] = useState(10);
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [lastResult, setLastResult] = useState<{ result: 'won' | 'lost'; payout: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoTarget, setAutoTarget] = useState(2.0);

  // Reset this slot's bet state whenever a new betting phase starts.
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (phase === 'betting' && prevPhase.current !== 'betting') {
      setHasBet(false);
      setCashedOut(false);
    }
    // When the round crashes and we still hold a non-cashed bet, mark it lost.
    if (phase === 'crashed' && prevPhase.current === 'flying' && hasBet && !cashedOut) {
      setLastResult({ result: 'lost', payout: 0 });
    }
    prevPhase.current = phase;
  }, [phase, hasBet, cashedOut]);

  const canBet = phase === 'betting' && !hasBet && !cashedOut && balance >= betAmount;
  const canCashout = phase === 'flying' && hasBet && !cashedOut;

  const handleBet = async () => {
    if (!canBet || !userId || !roundId) return;
    setLoading(true);
    try {
      const result = await placeBet(roundId, betAmount, slot);
      setHasBet(true);
      setBalance(result.balance);
      setLastResult(null);
    } catch (err) {
      console.error('[Bet Error]', err);
    } finally {
      setLoading(false);
    }
  };

  const doCashout = async () => {
    const s = useGameStore.getState();
    if (s.phase !== 'flying' || !s.userId || !s.roundId || !hasBet || cashedOut) return;
    setLoading(true);
    try {
      const result = await cashout(s.roundId, slot);
      setCashedOut(true);
      setBalance(result.balance);
      setLastResult({ result: 'won', payout: result.payout });
      playCashout();
    } catch (err) {
      console.error('[Cashout Error]', err);
      setCashedOut(true);
      setLastResult({ result: 'lost', payout: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Auto-cashout: trigger once the multiplier reaches the target.
  const firedRef = useRef(false);
  useEffect(() => {
    if (phase !== 'flying') {
      firedRef.current = false; // reset each round
      return;
    }
    if (autoEnabled && hasBet && !cashedOut && !firedRef.current && currentMultiplier >= autoTarget) {
      firedRef.current = true;
      doCashout();
    }
  }, [currentMultiplier, phase, autoEnabled, hasBet, cashedOut, autoTarget]);

  const presets = [5, 10, 20, 50, 100];

  return (
    <div className="bg-gray-900 border border-orange-900/40 rounded-xl p-4 space-y-3">
      {/* Slot label */}
      <div className="flex justify-between items-center">
        <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Pari {slot}</span>
        {lastResult && (
          <span
            className={`text-xs font-bold ${
              lastResult.result === 'won' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {lastResult.result === 'won'
              ? `✅ +${lastResult.payout.toFixed(2)} €`
              : '❌ Perdu'}
          </span>
        )}
      </div>

      {/* Bet amount */}
      <div>
        <label className="text-gray-400 text-xs mb-1 block">Mise (€)</label>
        <input
          type="number"
          min={1}
          max={balance}
          value={betAmount}
          onChange={(e) => {
            const v = Number(e.target.value);
            setBetAmount(Number.isFinite(v) && v > 0 ? v : 1);
          }}
          disabled={hasBet}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-center font-bold focus:outline-none focus:border-orange-500"
        />
        <div className="flex gap-2 mt-2">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setBetAmount(p)}
              disabled={hasBet}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-1 rounded-md transition disabled:opacity-40"
            >
              {p}€
            </button>
          ))}
        </div>
      </div>

      {/* Auto-cashout */}
      <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-gray-300 text-sm font-bold">⚡ Auto-encaissement</span>
          <input
            type="checkbox"
            checked={autoEnabled}
            onChange={(e) => setAutoEnabled(e.target.checked)}
            disabled={hasBet}
            className="w-4 h-4 accent-orange-500"
          />
        </label>
        {autoEnabled && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">Encaisser à ×</span>
            <input
              type="number"
              min={1.01}
              step={0.1}
              value={autoTarget}
              onChange={(e) => {
                const v = Number(e.target.value);
                setAutoTarget(Number.isFinite(v) && v > 1 ? v : 1.5);
              }}
              disabled={hasBet}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-2 py-1 text-white text-center text-sm font-bold focus:outline-none focus:border-orange-500"
            />
          </div>
        )}
      </div>

      {/* Bet / Cashout button */}
      {!hasBet ? (
        <button
          onClick={handleBet}
          disabled={!canBet}
          className="w-full py-3 rounded-xl font-bold text-white text-lg transition-all
            bg-gradient-to-r from-orange-500 to-red-500
            hover:from-orange-400 hover:to-red-400
            disabled:opacity-40 disabled:cursor-not-allowed
            active:scale-95"
        >
          {phase === 'betting'
            ? '🎯 MISER'
            : phase === 'flying'
            ? '✈️ En vol... (trop tard)'
            : '⏳ Prochaine manche'}
        </button>
      ) : (
        <button
          onClick={doCashout}
          disabled={!canCashout || loading || cashedOut}
          className="w-full py-3 rounded-xl font-bold text-white text-lg transition-all
            bg-gradient-to-r from-green-500 to-emerald-500
            hover:from-green-400 hover:to-emerald-400
            disabled:opacity-40 disabled:cursor-not-allowed
            active:scale-95 animate-pulse"
        >
          {cashedOut
            ? '✅ Encaissé !'
            : loading
            ? '⏳ Traitement...'
            : `💸 ENCAISSER × ${currentMultiplier.toFixed(2)}`}
        </button>
      )}

      {/* Potential win */}
      {hasBet && !cashedOut && (
        <div className="text-center text-sm text-gray-400">
          Gain potentiel :{' '}
          <span className="text-green-400 font-bold">
            {(betAmount * currentMultiplier).toFixed(2)} €
          </span>
        </div>
      )}
    </div>
  );
};

export default BetPanel;
