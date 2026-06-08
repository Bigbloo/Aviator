/**
 * DepositModal.tsx
 * USDT (TRC-20) deposit. Generates a pay-in address, shows a QR, and polls the
 * deposit status until the payment is confirmed on-chain. In mock mode a
 * "simulate payment" button lets you complete the flow without real crypto.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import {
  createCryptoDeposit,
  getCryptoDeposit,
  getCryptoCurrencies,
  mockConfirmDeposit,
  getBalance,
  type CryptoDeposit,
  type CryptoCurrency,
} from '@/lib/api';

interface Props {
  onClose: () => void;
}

const presets = [15, 25, 50, 100, 200];
const MIN_DEPOSIT = 15;

const DepositModal = ({ onClose }: Props) => {
  const { setBalance } = useGameStore();
  const [amount, setAmount] = useState(20);
  const [currencies, setCurrencies] = useState<CryptoCurrency[]>([]);
  const [payCurrency, setPayCurrency] = useState('usdttrc20');
  const [deposit, setDeposit] = useState<CryptoDeposit | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load the list of pay-in currencies once.
  useEffect(() => {
    getCryptoCurrencies()
      .then((list) => {
        if (list.length) setCurrencies(list);
      })
      .catch(() => {});
  }, []);

  const refreshBalance = async () => {
    try {
      const me = await getBalance();
      setBalance(me.balance);
    } catch {
      /* ignore */
    }
  };

  // Poll the deposit status until it settles.
  useEffect(() => {
    if (!deposit || status === 'finished' || status === 'failed') return;
    pollRef.current = setInterval(async () => {
      try {
        const d = await getCryptoDeposit(deposit.depositId);
        setStatus(d.status);
        if (d.status === 'finished') {
          await refreshBalance();
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [deposit, status]);

  const handleCreate = async () => {
    if (amount < MIN_DEPOSIT) {
      setError(`Dépôt minimum : ${MIN_DEPOSIT} USDT.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const d = await createCryptoDeposit(amount, payCurrency);
      setDeposit(d);
      setStatus(d.status);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du dépôt');
    } finally {
      setLoading(false);
    }
  };

  const handleMockConfirm = async () => {
    if (!deposit) return;
    setLoading(true);
    try {
      const r = await mockConfirmDeposit(deposit.depositId);
      setStatus('finished');
      setBalance(r.balance);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (!deposit) return;
    navigator.clipboard.writeText(deposit.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const qrUrl = deposit
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(deposit.address)}`
    : '';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-orange-900/40 rounded-2xl p-6 w-full max-w-sm space-y-5 my-8">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-bold text-xl">₮ Déposer en USDT</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {status === 'finished' ? (
          <div className="text-center py-6 space-y-2">
            <div className="text-4xl">✅</div>
            <p className="text-green-400 font-bold">Dépôt de {deposit?.amount} USDT confirmé !</p>
            <button onClick={onClose} className="mt-2 w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
              Fermer
            </button>
          </div>
        ) : !deposit ? (
          <>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Montant (USDT)</label>
              <input
                type="number"
                min={MIN_DEPOSIT}
                value={amount}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setAmount(Number.isFinite(v) && v > 0 ? v : MIN_DEPOSIT);
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
                    {p}
                  </button>
                ))}
              </div>
              <p className="text-gray-600 text-xs mt-1">Solde crédité en USDT · minimum {MIN_DEPOSIT}</p>
            </div>

            {/* Crypto selector */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Payer avec</label>
              <select
                value={payCurrency}
                onChange={(e) => setPayCurrency(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              >
                {(currencies.length ? currencies : [{ code: 'usdttrc20', name: 'USDT', network: 'TRC-20 (Tron)' }]).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} — {c.network}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={loading || amount < MIN_DEPOSIT}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-40 transition active:scale-95"
            >
              {loading ? '⏳ Génération...' : `Générer l'adresse de dépôt`}
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-400 text-sm text-center">
              Envoie exactement{' '}
              <span className="text-orange-400 font-bold">
                {deposit.payAmount} {deposit.payCurrency.toUpperCase().replace(/(TRC20|ERC20|BSC|SOL)$/,'')}
              </span>{' '}
              <span className="text-gray-500">({deposit.network})</span> à l&apos;adresse ci-dessous.
              <br />
              <span className="text-gray-500 text-xs">Tu seras crédité de {deposit.amount} USDT.</span>
            </p>

            {qrUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={qrUrl} alt="QR adresse de dépôt" className="mx-auto rounded-lg bg-white p-2" width={180} height={180} />
            )}

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">Adresse de dépôt ({deposit.network})</p>
              <p className="text-white text-xs font-mono break-all">{deposit.address}</p>
              <button
                onClick={copyAddress}
                className="mt-2 w-full py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-md transition"
              >
                {copied ? '✓ Copié' : '📋 Copier l’adresse'}
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              {status === 'confirming' ? 'Paiement détecté, confirmation…' : 'En attente du paiement…'}
            </div>

            {deposit.mock && (
              <button
                onClick={handleMockConfirm}
                disabled={loading}
                className="w-full py-2.5 rounded-lg font-bold text-black bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 transition"
              >
                {loading ? '⏳…' : '🧪 Simuler le paiement reçu (test)'}
              </button>
            )}

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default DepositModal;
