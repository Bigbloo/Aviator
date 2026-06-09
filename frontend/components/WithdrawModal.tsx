/**
 * WithdrawModal.tsx
 * USDT (TRC-20) withdrawal — sends winnings to a player-provided Tron address.
 */

'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { createCryptoWithdrawal } from '@/lib/api';

interface Props {
  onClose: () => void;
}

const TRC20_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const MIN_WITHDRAW = 1; // baissé pour test — remettre ~10 ensuite

const WithdrawModal = ({ onClose }: Props) => {
  const { balance, setBalance } = useGameStore();
  const [amount, setAmount] = useState(10);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const addressValid = TRC20_RE.test(address.trim());
  const canSubmit = amount >= MIN_WITHDRAW && amount <= balance && addressValid;

  const handleWithdraw = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const data = await createCryptoWithdrawal(amount, address.trim());
      setBalance(data.balance);
      setMessage(data.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du retrait');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-orange-900/40 rounded-2xl p-6 w-full max-w-sm space-y-5 my-8">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-bold text-xl">₮ Retirer en USDT</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {message ? (
          <div className="text-center py-4 space-y-3">
            <div className="text-4xl">✅</div>
            <p className="text-green-400 text-sm">{message}</p>
            <p className="text-gray-400 text-sm">
              Nouveau solde : <span className="text-orange-400 font-bold">{balance.toFixed(2)} USDT</span>
            </p>
            <button onClick={onClose} className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div className="text-gray-400 text-sm">
              Solde disponible : <span className="text-orange-400 font-bold">{balance.toFixed(2)} USDT</span>
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Montant (USDT)</label>
              <input
                type="number"
                min={MIN_WITHDRAW}
                max={balance}
                value={amount}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setAmount(Number.isFinite(v) && v > 0 ? v : MIN_WITHDRAW);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-center text-xl font-bold focus:outline-none focus:border-orange-500"
              />
              <p className="text-gray-600 text-xs mt-1">Minimum {MIN_WITHDRAW} USDT</p>
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Adresse USDT (TRC-20)</label>
              <input
                type="text"
                value={address}
                placeholder="T..."
                onChange={(e) => setAddress(e.target.value)}
                className={`w-full bg-gray-800 border rounded-lg px-4 py-3 text-white text-xs font-mono focus:outline-none ${
                  address.length > 0 && !addressValid
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-gray-700 focus:border-orange-500'
                }`}
              />
              {address.length > 0 && !addressValid && (
                <p className="text-red-400 text-xs mt-1">Adresse TRC-20 invalide (doit commencer par T, 34 caractères).</p>
              )}
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              onClick={handleWithdraw}
              disabled={loading || !canSubmit}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-40 transition active:scale-95"
            >
              {loading ? '⏳ Traitement...' : `Retirer ${amount} USDT`}
            </button>

            <p className="text-gray-600 text-xs text-center">
              Réseau : USDT TRC-20 (Tron). Vérifie bien l&apos;adresse — une erreur est irréversible.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default WithdrawModal;
