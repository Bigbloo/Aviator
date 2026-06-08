/**
 * WithdrawModal.tsx
 * Withdrawal modal — simulated in test mode.
 */

'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { withdraw } from '@/lib/api';

interface Props {
  onClose: () => void;
}

const WithdrawModal = ({ onClose }: Props) => {
  const { userId, balance, setBalance } = useGameStore();
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleWithdraw = async () => {
    if (!userId || amount < 1 || amount > balance) return;
    setLoading(true);
    setError('');
    try {
      const data = await withdraw(userId, amount);
      setBalance(data.balance);
      setMessage(data.message);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du retrait');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-orange-900/40 rounded-2xl p-6 w-full max-w-sm space-y-5">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-bold text-xl">💸 Retirer des fonds</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {message ? (
          <div className="text-center py-4 space-y-3">
            <div className="text-4xl">✅</div>
            <p className="text-green-400 text-sm">{message}</p>
            <p className="text-gray-400 text-sm">Nouveau solde : <span className="text-orange-400 font-bold">{balance.toFixed(2)} €</span></p>
            <button onClick={onClose} className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">Fermer</button>
          </div>
        ) : (
          <>
            <div className="text-gray-400 text-sm">
              Solde disponible : <span className="text-orange-400 font-bold">{balance.toFixed(2)} €</span>
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Montant à retirer (€)</label>
              <input
                type="number"
                min={1}
                max={balance}
                value={amount}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setAmount(Number.isFinite(v) && v > 0 ? v : 1);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-center text-xl font-bold focus:outline-none focus:border-orange-500"
              />
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              onClick={handleWithdraw}
              disabled={loading || amount < 1 || amount > balance}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-40 transition active:scale-95"
            >
              {loading ? '⏳ Traitement...' : `Retirer ${amount}€`}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default WithdrawModal;
