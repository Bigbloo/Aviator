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

const presets = [2, 5, 10, 25, 50];
const MIN_DEPOSIT = 1;

// Fallback if the currencies endpoint is unreachable.
const FALLBACK_CURRENCIES: CryptoCurrency[] = [
  { code: 'sol', name: 'Solana', network: 'Solana', symbol: '◎', color: '#9945FF' },
];

// Round colored badge with the crypto's original symbol.
const CoinBadge = ({ c, size = 7 }: { c: CryptoCurrency; size?: number }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 ${size === 7 ? 'w-7 h-7 text-sm' : 'w-6 h-6 text-xs'}`}
    style={{ backgroundColor: c.color || '#4b5563' }}
  >
    {c.symbol || c.name.charAt(0)}
  </span>
);

const DepositModal = ({ onClose }: Props) => {
  const { setBalance } = useGameStore();
  const [amount, setAmount] = useState(5);
  const [currencies, setCurrencies] = useState<CryptoCurrency[]>([]);
  const [payCurrency, setPayCurrency] = useState('sol');
  const [deposit, setDeposit] = useState<CryptoDeposit | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load the list of pay-in currencies once; default to the first available.
  useEffect(() => {
    getCryptoCurrencies()
      .then((list) => {
        if (list.length) {
          setCurrencies(list);
          if (!list.some((c) => c.code === payCurrency)) setPayCurrency(list[0].code);
        }
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
      // Hosted-invoice provider (Plisio): redirect to the secure payment page.
      if (d.invoiceUrl) {
        window.location.href = d.invoiceUrl;
        return;
      }
      setDeposit(d);
      setStatus(d.status);
      // Demo mode credits instantly — reflect the new balance right away.
      if (d.status === 'finished') await refreshBalance();
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
    if (!deposit || !deposit.address) return;
    navigator.clipboard.writeText(deposit.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const qrUrl = deposit && deposit.address
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

            {/* Crypto selector — custom dropdown styled like the rest of the site */}
            <div className="relative">
              <label className="text-gray-400 text-sm mb-2 block">Payer avec</label>
              {(() => {
                const list = currencies.length ? currencies : FALLBACK_CURRENCIES;
                const selected = list.find((c) => c.code === payCurrency) || list[0];
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setPickerOpen((o) => !o)}
                      className="w-full flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white hover:border-gray-600 focus:outline-none focus:border-orange-500 transition"
                    >
                      <CoinBadge c={selected} />
                      <span className="font-semibold">{selected.name}</span>
                      <span className="text-gray-500 text-sm">{selected.network}</span>
                      <span className={`ml-auto text-gray-500 text-xs transition-transform ${pickerOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {pickerOpen && (
                      <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl shadow-black/50 overflow-hidden">
                        {list.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setPayCurrency(c.code);
                              setPickerOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                              c.code === payCurrency ? 'bg-orange-500/15 text-orange-300' : 'text-white hover:bg-gray-700'
                            }`}
                          >
                            <CoinBadge c={c} size={6} />
                            <span className="font-semibold text-sm">{c.name}</span>
                            <span className="text-gray-500 text-xs ml-auto">{c.network}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
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
