/**
 * BetPanel.tsx
 * Spribe-style bet controls for a SINGLE slot (render two for the double bet).
 * Bet/Auto tabs, a -/+ amount stepper with preset chips, and a large green
 * BET button that turns into a CASH OUT button while flying. Amounts in USDT.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { placeBet, cashout } from '@/lib/api';
import { playCashout } from '@/lib/sound';

interface BetPanelProps {
  slot?: 1 | 2;
}

const presets = [1, 2, 5, 10];
const MIN_BET = 1;

const BetPanel = ({ slot = 1 }: BetPanelProps) => {
  const { userId, balance, phase, roundId, currentMultiplier, setBalance, showResult } = useGameStore();

  const [tab, setTab] = useState<'bet' | 'auto'>('bet');
  const [betAmount, setBetAmount] = useState(1);
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [lastResult, setLastResult] = useState<{ result: 'won' | 'lost'; payout: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoTarget, setAutoTarget] = useState(2.0);

  const prevPhase = useRef(phase);
  useEffect(() => {
    if (phase === 'betting' && prevPhase.current !== 'betting') {
      setHasBet(false);
      setCashedOut(false);
    }
    if (phase === 'crashed' && prevPhase.current === 'flying' && hasBet && !cashedOut) {
      setLastResult({ result: 'lost', payout: 0 });
      showResult(false, betAmount);
    }
    prevPhase.current = phase;
  }, [phase, hasBet, cashedOut]);

  const canBet = phase === 'betting' && !hasBet && !cashedOut && balance >= betAmount;
  const canCashout = phase === 'flying' && hasBet && !cashedOut;

  const adjust = (delta: number) =>
    setBetAmount((a) => Math.max(MIN_BET, Math.round((a + delta) * 100) / 100));

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
      showResult(true, result.payout);
      playCashout();
    } catch (err) {
      console.error('[Cashout Error]', err);
      setCashedOut(true);
      setLastResult({ result: 'lost', payout: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Auto-cashout
  const firedRef = useRef(false);
  useEffect(() => {
    if (phase !== 'flying') {
      firedRef.current = false;
      return;
    }
    if (tab === 'auto' && hasBet && !cashedOut && !firedRef.current && currentMultiplier >= autoTarget) {
      firedRef.current = true;
      doCashout();
    }
  }, [currentMultiplier, phase, tab, hasBet, cashedOut, autoTarget]);

  return (
    <div className="bg-[#1b1c1d] rounded-2xl p-2.5 border border-black/30">
      {/* Bet / Auto tabs */}
      <div className="flex justify-center mb-2.5">
        <div className="inline-flex bg-[#101112] rounded-full p-0.5 text-xs font-bold">
          <button
            onClick={() => setTab('bet')}
            className={`px-5 py-1 rounded-full transition ${tab === 'bet' ? 'bg-[#3a3b3e] text-white' : 'text-gray-400'}`}
          >
            Bet
          </button>
          <button
            onClick={() => setTab('auto')}
            className={`px-5 py-1 rounded-full transition ${tab === 'auto' ? 'bg-[#3a3b3e] text-white' : 'text-gray-400'}`}
          >
            Auto
          </button>
        </div>
      </div>

      <div className="flex gap-2 items-stretch">
        {/* Amount + presets */}
        <div className="w-[46%] space-y-1.5">
          <div className="flex items-center justify-between bg-[#101112] rounded-full px-2 py-1.5">
            <button
              onClick={() => adjust(-1)}
              disabled={hasBet}
              className="w-6 h-6 rounded-full bg-[#2c2d30] text-gray-300 text-lg leading-none flex items-center justify-center disabled:opacity-40"
            >
              −
            </button>
            <input
              type="number"
              min={MIN_BET}
              value={betAmount}
              onChange={(e) => {
                const v = Number(e.target.value);
                setBetAmount(Number.isFinite(v) && v > 0 ? v : MIN_BET);
              }}
              disabled={hasBet}
              className="w-full bg-transparent text-white text-center font-bold text-base focus:outline-none"
            />
            <button
              onClick={() => adjust(1)}
              disabled={hasBet}
              className="w-6 h-6 rounded-full bg-[#2c2d30] text-gray-300 text-lg leading-none flex items-center justify-center disabled:opacity-40"
            >
              +
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setBetAmount(p)}
                disabled={hasBet}
                className="bg-[#101112] hover:bg-[#2c2d30] text-gray-300 text-xs py-1 rounded-md transition disabled:opacity-40"
              >
                {p.toFixed(2)}
              </button>
            ))}
          </div>
          {tab === 'auto' && (
            <div className="flex items-center gap-1 bg-[#101112] rounded-full px-2 py-1 mt-1">
              <span className="text-gray-500 text-[10px] whitespace-nowrap">Auto ×</span>
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
                className="w-full bg-transparent text-white text-center text-xs font-bold focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Big action button */}
        <div className="flex-1">
          {!hasBet ? (
            <button
              onClick={handleBet}
              disabled={!canBet}
              className="w-full h-full min-h-[72px] rounded-2xl font-bold text-white border border-[#5bbf1c]/40
                bg-gradient-to-b from-[#5bbf1c] to-[#28a909] hover:from-[#69d122] hover:to-[#2fbf0c]
                disabled:from-gray-600 disabled:to-gray-700 disabled:border-gray-600 disabled:opacity-60
                transition active:scale-[0.98] flex flex-col items-center justify-center leading-tight shadow-lg"
            >
              <span className="text-lg">{phase === 'betting' ? 'BET' : phase === 'flying' ? 'WAIT' : 'NEXT'}</span>
              <span className="text-sm font-extrabold">{betAmount.toFixed(2)} USDT</span>
            </button>
          ) : (
            <button
              onClick={doCashout}
              disabled={!canCashout || loading || cashedOut}
              className="w-full h-full min-h-[72px] rounded-2xl font-bold text-black border border-[#f5a623]/40
                bg-gradient-to-b from-[#ffcf4a] to-[#f5a623] hover:from-[#ffd866] hover:to-[#ffb52e]
                disabled:opacity-60 transition active:scale-[0.98] flex flex-col items-center justify-center leading-tight shadow-lg"
            >
              {cashedOut ? (
                <>
                  <span className="text-base">CASHED OUT</span>
                  <span className="text-sm font-extrabold">
                    +{lastResult?.payout.toFixed(2)} USDT
                  </span>
                </>
              ) : (
                <>
                  <span className="text-base">CASH OUT</span>
                  <span className="text-sm font-extrabold">
                    {(betAmount * currentMultiplier).toFixed(2)} USDT
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BetPanel;
