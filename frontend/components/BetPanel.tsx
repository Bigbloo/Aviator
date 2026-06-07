/**
 * BetPanel.tsx
 * Bet controls: amount input, bet button, cashout button.
 * Communicates with backend via API calls.
 */

'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { placeBet, cashout } from '@/lib/api';

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

  const [loading, setLoading] = useState(false);

  const canBet = phase === 'betting' && !hasBet && !cashedOut && balance >= betAmount;
  const canCashout = phase === 'flying' && hasBet && !cashedOut;

  const handleBet = async () => {
    if (!canBet || !userId || !roundId) return;
    setLoading(true);
    try {
      const result = await placeBet(userId, roundId, betAmount);
      setHasBet(true);
      setBalance(result.balance);
      setLastResult(null);
    } catch (err) {
      console.error('[Bet Error]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCashout = async () => {
    if (!canCashout || !userId || !roundId) return;
    setLoading(true);
    try {
      const result = await cashout(userId, roundId);
      setCashedOut(true);
      setBalance(result.balance);
      setLastResult({ result: 'won', payout: result.payout });
    } catch (err) {
      console.error('[Cashout Error]', err);
      // If cashout failed because it crashed, the bet is lost server-side
      setCashedOut(true);
      setLastResult({ result: 'lost', payout: 0 });
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
          onChange={(e) => {
            const v = Number(e.target.value);
            setBetAmount(Number.isFinite(v) && v > 0 ? v : 1);
          }}
          disabled={hasBet}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-center font-bold focus:outline-none focus:border-orange-500"
        />
        {/* Preset amounts */}
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
          onClick={handleCashout}
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
