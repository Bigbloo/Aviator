/**
 * DepositModal.tsx
 * Deposit modal with two modes:
 * - DEV: simulate deposit instantly (no Stripe needed)
 * - PROD: Stripe Elements for real card payment
 */

'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { simulateDeposit } from '@/lib/api';

interface Props {
  onClose: () => void;
}

const DepositModal = ({ onClose }: Props) => {
  const { userId, setBalance } = useGameStore();
  const [amount, setAmount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const presets = [10, 20, 50, 100, 200];

  const handleSimulateDeposit = async () => {
    if (!userId || amount < 1) return;
    setLoading(true);
    setError('');
    try {
      const data = await simulateDeposit(amount);
      setBalance(data.balance);
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du dépôt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-orange-900/40 rounded-2xl p-6 w-full max-w-sm space-y-5">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-bold text-xl">💳 Déposer des fonds</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-green-400 font-bold">Dépôt de {amount}€ effectué !</p>
          </div>
        ) : (
          <>
            {/* Amount */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Montant (€)</label>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setAmount(Number.isFinite(v) && v > 0 ? v : 1);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-center text-xl font-bold focus:outline-none focus:border-orange-500"
              />
              <div className="flex gap-2 mt-2">
                {presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAmount(p)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-1.5 rounded-md transition"
                  >
                    {p}€
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            {/* DEV mode: simulate */}
            <button
              onClick={handleSimulateDeposit}
              disabled={loading || amount < 1}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-40 transition active:scale-95"
            >
              {loading ? '⏳ Traitement...' : `🚀 Déposer ${amount}€ (Mode Test)`}
            </button>

            <p className="text-gray-600 text-xs text-center">
              Mode test — aucun vrai paiement effectué.{' '}
              <br />
              En production, remplacer par Stripe Elements.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default DepositModal;
