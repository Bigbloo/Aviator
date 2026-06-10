/**
 * BetPanel.tsx
 * Panneau de mise avec :
 *  - Option de revanche forcée (mise doublée après une perte)
 *  - Proposition automatique de mise maximale après N pertes consécutives
 *  - Seed individualisé affiché pour vérifiabilité
 *  - Interface de stress visuel (bordure + couleurs selon tension)
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSocketContext } from '@/lib/socketContext';
import { placeBet } from '@/lib/api';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const BetPanel = () => {
  const {
    phase,
    roundId,
    userId,
    balance,
    currentMultiplier,
    tensionLevel,
    sessionSeed,
    serverSeed,
    consecutiveLosses,
    revengeAvailable,
    lastLostAmount,
    maxBetSuggestion,
    setBalance,
    setHasBet,
    setCashedOut,
    setLastResult,
    setBetAmount,
    incrementLosses,
    resetLosses,
    setRevengeAvailable,
    setLastLostAmount,
    setMaxBetSuggestion,
  } = useGameStore();

  const hasBet    = useGameStore((s) => s.hasBet);
  const cashedOut = useGameStore((s) => s.cashedOut);
  const betAmount = useGameStore((s) => s.betAmount);
  const lastResult = useGameStore((s) => s.lastResult);

  const { cashout } = useSocketContext();

  const [loading, setLoading]   = useState(false);
  const [showRevenge, setShowRevenge] = useState(false);

  const betAmountRef = useRef(betAmount);
  const betSentRef   = useRef(false);
  const betRoundRef  = useRef<string | null>(null);

  useEffect(() => { betAmountRef.current = betAmount; }, [betAmount]);

  // Quand le round crash et que le joueur avait une mise active → perte
  useEffect(() => {
    if (phase === 'crashed' && hasBet && !cashedOut && betSentRef.current) {
      setLastResult({ result: 'lost', payout: 0 });
      // Incrémenter les pertes consécutives
      incrementLosses();
      setLastLostAmount(betAmountRef.current);
      setRevengeAvailable(true);
      setShowRevenge(true);
      // Vérifier si suggestion de mise max
      checkMaxBetSuggestion();
    }
  }, [phase, hasBet, cashedOut]);

  // Reset tracking au début d'un nouveau round
  useEffect(() => {
    if (phase === 'flying' && !hasBet) {
      betSentRef.current  = false;
      betRoundRef.current = null;
      setShowRevenge(false);
    }
  }, [phase, hasBet]);

  // Vérifier la suggestion de mise max via l'API
  const checkMaxBetSuggestion = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${BASE_URL}/api/suggest/${userId}`);
      const data = await res.json();
      if (data.shouldSuggest && data.suggestedAmount) {
        setMaxBetSuggestion(data.suggestedAmount);
      }
    } catch {}
  };

  const canBet     = phase === 'flying' && !hasBet && !cashedOut && balance >= betAmount && betAmount > 0;
  const canCashout = phase === 'flying' && hasBet && !cashedOut && !loading;

  // Couleur de bordure selon la tension
  const panelBorderColor = tensionLevel > 0.7
    ? `rgba(255,${Math.round(80 - tensionLevel * 80)},0,0.7)`
    : 'rgba(194,65,12,0.4)';

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
      setShowRevenge(false);
    } catch (err) {
      console.error('[Bet Error]', err);
    } finally {
      setLoading(false);
    }
  };

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
      // Victoire → reset les pertes consécutives
      if (result.result === 'won') {
        resetLosses();
        setShowRevenge(false);
        setMaxBetSuggestion(null);
      }
    } catch (err) {
      console.error('[Cashout Error]', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Revanche forcée ─────────────────────────────────────────────────────────
  const handleRevenge = async () => {
    if (!userId || !roundId || phase !== 'flying') return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/revenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roundId }),
      });
      const data = await res.json();
      if (data.error) {
        console.error('[Revenge Error]', data.error);
        return;
      }
      betRoundRef.current = roundId;
      betSentRef.current  = true;
      setHasBet(true);
      setBalance(data.balance);
      setBetAmount(data.betAmount);
      setLastResult(null);
      setShowRevenge(false);
      setRevengeAvailable(false);
    } catch (err) {
      console.error('[Revenge Error]', err);
    } finally {
      setLoading(false);
    }
  };

  const presets = [5, 10, 20, 50, 100];

  return (
    <div
      className="bg-gray-900 rounded-xl p-4 space-y-4 transition-all duration-300"
      style={{
        border: `1px solid ${panelBorderColor}`,
        boxShadow: tensionLevel > 0.6
          ? `0 0 ${Math.round(tensionLevel * 20)}px rgba(255,60,0,${tensionLevel * 0.2})`
          : undefined,
      }}
    >
      {/* Balance */}
      <div className="flex justify-between items-center">
        <span className="text-gray-400 text-sm">Solde</span>
        <span className="text-orange-400 font-bold text-lg">{balance.toFixed(2)} €</span>
      </div>

      {/* Dernier résultat */}
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
            : `❌ Perdu ! (${consecutiveLosses} perte${consecutiveLosses > 1 ? 's' : ''} consécutive${consecutiveLosses > 1 ? 's' : ''})`}
        </div>
      )}

      {/* Suggestion de mise maximale */}
      {maxBetSuggestion !== null && !hasBet && (
        <div className="bg-yellow-900/30 border border-yellow-600/40 rounded-lg p-3 text-center">
          <p className="text-yellow-400 text-xs font-bold mb-1">
            🎯 Après {consecutiveLosses} pertes — Mise totale suggérée
          </p>
          <p className="text-yellow-300 text-sm mb-2">
            Misez <strong>{maxBetSuggestion.toFixed(2)} €</strong> pour un retour potentiel !
          </p>
          <button
            onClick={() => {
              setBetAmount(maxBetSuggestion);
              setMaxBetSuggestion(null);
            }}
            className="bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-md transition"
          >
            Appliquer {maxBetSuggestion.toFixed(2)} €
          </button>
        </div>
      )}

      {/* Option de revanche forcée */}
      {showRevenge && revengeAvailable && phase === 'flying' && !hasBet && (
        <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3 text-center animate-pulse">
          <p className="text-red-400 text-xs font-bold mb-1">⚡ REVANCHE DISPONIBLE</p>
          <p className="text-red-300 text-sm mb-2">
            Mise doublée : <strong>{(lastLostAmount * 2).toFixed(2)} €</strong>
          </p>
          <button
            onClick={handleRevenge}
            disabled={loading || balance < lastLostAmount * 2}
            className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500
              text-white font-bold py-2 rounded-lg text-sm transition disabled:opacity-40"
          >
            {loading ? '⏳...' : '🔥 REVANCHE ×2'}
          </button>
        </div>
      )}

      {/* Montant de la mise */}
      <div>
        <label className="text-gray-400 text-xs mb-1 block">Mise (€)</label>
        <input
          type="number"
          min={1}
          max={balance}
          value={betAmount}
          onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value)))}
          disabled={hasBet || loading}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-center font-bold
            focus:outline-none focus:border-orange-500 disabled:opacity-60"
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

      {/* Bouton Miser / Encaisser */}
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
          style={{
            // Bordure rouge pulsante si tension très haute
            boxShadow: tensionLevel > 0.8
              ? `0 0 20px rgba(255,50,0,${tensionLevel * 0.6})`
              : undefined,
          }}
        >
          {cashedOut
            ? '✅ Encaissé !'
            : loading
            ? '⏳ Traitement...'
            : `💸 ENCAISSER × ${currentMultiplier.toFixed(2)}`}
        </button>
      )}

      {/* Gain potentiel */}
      {hasBet && !cashedOut && phase === 'flying' && (
        <div className="text-center text-sm text-gray-400">
          Gain potentiel :{' '}
          <span
            className="font-bold transition-colors duration-200"
            style={{
              color: tensionLevel > 0.7 ? '#ff6600' : '#4ade80',
            }}
          >
            {(betAmount * currentMultiplier).toFixed(2)} €
          </span>
        </div>
      )}

      {/* Seed individualisé — vérifiabilité */}
      {sessionSeed && serverSeed && (
        <div className="border-t border-gray-800 pt-2">
          <p className="text-gray-600 text-xs text-center font-mono">
            🔐 Seed: {serverSeed.slice(0, 8)}…{sessionSeed.slice(0, 6)}
          </p>
        </div>
      )}
    </div>
  );
};

export default BetPanel;
