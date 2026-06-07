/**
 * BetPanel.tsx
 * Bet controls: amount input, bet button, cashout button.
 *
 * Flow:
 *  1. Player clicks "MISER" → POST /api/bet (deducts balance, status=pending)
 *  2. Player clicks "ENCAISSER" → socket 'cashout' event with multiplierAtCashout
 *     → server verifies multiplierAtCashout < crashPoint (strictly less)
 *     → ack returns { result, payout, balance }
 *  3. If round crashes before cashout → loss shown via store resetRound
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSocketContext } from '@/lib/socketContext';
import { placeBet } from '@/lib/api';

const BetPanel = () => {
  const {
    userId,
    balance,
    phase,
    roundId,
    currentMultiplier,
    betAmount,
    hasBet,
    cashedOut,
    lastResult,
    setBetAmount,
    setHasBet,
    setCashedOut,
    setBalance,
    setLastResult,
  } = useGameStore();

  const { cashout } = useSocketContext();
  const [loading, setLoading] = useState(false);
  const betRoundRef  = useRef<string | null>(null);
  const betSentRef   = useRef(false);
  const betAmountRef = useRef<number>(betAmount);

  // Keep betAmountRef in sync so cashout closure has the right value
  useEffect(() => {
    betAmountRef.current = betAmount;
  }, [betAmount]);

  // When round crashes and player had an active bet (didn't cash out) → show loss
  useEffect(() => {
    if (phase === 'crashed' && hasBet && !cashedOut && betSentRef.current) {
      setLastResult({ result: 'lost', payout: 0 });
    }
  }, [phase, hasBet, cashedOut]);

  // Reset bet tracking refs when a new round starts
  useEffect(() => {
    if (phase === 'flying' && !hasBet) {
      betSentRef.current  = false;
      betRoundRef.current = null;
    }
  }, [phase, hasBet]);

  const canBet     = phase === 'flying' && !hasBet && !cashedOut && balance >= betAmount && betAmount > 0;
  const canCashout = phase === 'flying' && hasBet && !cashedOut && !loading;

  /**
   * Place bet via REST — deducts balance, records pending bet.
   */
  const handleBet = async () => {
    if (!canBet || !userId || !roundId) return;
    setLoading(true);
    try {
      const result = await placeBet(userId, roundId, betAmount, 0);
      betRoundRef.current = roundId;
      betSentRef.current  = true;
      setHasBet(true);
      setBalance(result.balance);
      setLastResult(null);
    } catch (err) {
      console.error('[Bet Error]', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cash out via Socket.IO — lower latency than REST.
   * Server verifies multiplierAtCashout < crashPoint (strictly less).
   */
  const handleCashout = async () => {
    if (!canCashout || !userId) return;
    const activeRoundId = betRoundRef.current || roundId;
    if (!activeRoundId) return;

    setLoading(true);
    try {
      const result = await cashout({
        userId,
        roundId: activeRoundId,
        betAmount: betAmountRef.current,
        multiplierAtCashout: currentMultiplier,
      });

      if (result.error) {
        console.error('[Cashout Error]', result.error);
        return;
      }

      setCashedOut(true);
      if (result.balance !== undefined) setBalance(result.balance);
      setLastResult({
        result: (result.result as 'won' | 'lost') || 'lost',
        payout: result.payout ?? 0,
      });
    } catch (err) {
      console.error('[Cashout Error]', err);
    } finally {
      setLoading(false);
    }
  };

  const presets = [5, 10, 20, 50, 100];

  return (
    <div className="bg-gray-900 border border-orange-900/40 rounded-xl p-4 space-y-4">
      {/* Balance */}
      <div className="flex justify-between items-center">
        <span className="text-gray-400 text-sm">Solde</span>
        <span className="text-orange-400 font-bold text-lg">
          {balance.toFixed(2)} €
        </span>
      </div>

      {/* Last result */}
      {lastResult && (
        <div
          className={`text-center py-2 rounded-lg font-bold text-sm ${
            lastResult.result === 'won'
              ? 'bg-green-900/40 text-green-400'
              : 'bg-red-900/40 text-red-400'
          }`}
        >
          {lastResult.result === 'won'
            ? `✅ Gagné ! +${lastResult.payout.toFixed(2)} €`
            : '❌ Perdu !'}
        </div>
      )}

      {/* Bet amount */}
      <div>
        <label className="text-gray-400 text-xs mb-1 block">Mise (€)</label>
        <input
          type="number"
          min={1}
          max={balance}
          value={betAmount}
          onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value)))}
          disabled={hasBet || loading}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-center font-bold focus:outline-none focus:border-orange-500 disabled:opacity-60"
        />
        <div className="flex gap-2 mt-2">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setBetAmount(p)}
              disabled={hasBet || loading}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-1 rounded-md transition disabled:opacity-40"
            >
              {p}€
            </button>
          ))}
        </div>
      </div>

      {/* Bet / Cashout button */}
      {!hasBet ? (
        <button
          onClick={handleBet}
          disabled={!canBet || loading}
          className="w-full py-3 rounded-xl font-bold text-white text-lg transition-all
            bg-gradient-to-r from-orange-500 to-red-500
            hover:from-orange-400 hover:to-red-400
            disabled:opacity-40 disabled:cursor-not-allowed
            active:scale-95"
        >
          {loading
            ? '⏳ Traitement...'
            : phase === 'waiting'
            ? '⏳ Attendre la prochaine manche'
            : phase === 'crashed'
            ? '⏳ Prochaine manche...'
            : '🎯 MISER'}
        </button>
      ) : (
        <button
          onClick={handleCashout}
          disabled={!canCashout}
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
      {hasBet && !cashedOut && phase === 'flying' && (
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
