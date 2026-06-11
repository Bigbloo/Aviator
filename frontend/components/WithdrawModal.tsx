/**
 * WithdrawModal.tsx
 * Multi-network withdrawal — the player picks a payout chain (same chains as
 * deposits) and provides an address on it. Balance stays in USDT; the admin
 * sends the USDT-equivalent in the chosen crypto.
 */

'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { createCryptoWithdrawal, getCryptoCurrencies, type CryptoCurrency } from '@/lib/api';

interface Props {
  onClose: () => void;
}

const MIN_WITHDRAW = 1; // lowered for testing — restore to ~10 later

// Per-network address validators + placeholder, mirrored from the backend.
const NETWORKS: Record<string, { re: RegExp; placeholder: string }> = {
  btc:    { re: /^(bc1[a-z0-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/, placeholder: 'bc1… or 1…/3…' },
  ltc:    { re: /^(ltc1[a-z0-9]{11,71}|[LM][a-km-zA-HJ-NP-Z1-9]{26,33}|3[a-km-zA-HJ-NP-Z1-9]{25,33})$/, placeholder: 'ltc1… or L…/M…' },
  sol:    { re: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, placeholder: 'Solana address' },
  ton:    { re: /^(?:[A-Za-z0-9_-]{48}|[0-9-]:[0-9a-fA-F]{64})$/, placeholder: 'EQ… / UQ…' },
  bnbbsc: { re: /^0x[0-9a-fA-F]{40}$/, placeholder: '0x…' },
  xmr:    { re: /^[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93,104}$/, placeholder: '4… / 8…' },
};

const FALLBACK: CryptoCurrency[] = [
  { code: 'sol', name: 'Solana', network: 'Solana', symbol: '◎', color: '#9945FF' },
];

const CoinBadge = ({ c, size = 7 }: { c: CryptoCurrency; size?: number }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 ${size === 7 ? 'w-7 h-7 text-sm' : 'w-6 h-6 text-xs'}`}
    style={{ backgroundColor: c.color || '#4b5563' }}
  >
    {c.symbol || c.name.charAt(0)}
  </span>
);

const WithdrawModal = ({ onClose }: Props) => {
  const { balance, setBalance } = useGameStore();
  const [amount, setAmount] = useState(Math.max(MIN_WITHDRAW, Math.min(10, balance)));
  const [address, setAddress] = useState('');
  const [currencies, setCurrencies] = useState<CryptoCurrency[]>([]);
  const [currency, setCurrency] = useState('sol');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getCryptoCurrencies()
      .then((list) => {
        if (list.length) {
          setCurrencies(list);
          if (!list.some((c) => c.code === currency)) setCurrency(list[0].code);
        }
      })
      .catch(() => {});
  }, []);

  const net = NETWORKS[currency];
  const addressValid = net ? net.re.test(address.trim()) : false;
  const canSubmit = amount >= MIN_WITHDRAW && amount <= balance && addressValid;

  const list = currencies.length ? currencies : FALLBACK;
  const selected = list.find((c) => c.code === currency) || list[0];

  const handleWithdraw = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const data = await createCryptoWithdrawal(amount, address.trim(), currency);
      setBalance(data.balance);
      setMessage(data.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Withdrawal error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-orange-900/40 rounded-2xl p-6 w-full max-w-sm space-y-5 my-8">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-bold text-xl">₮ Withdraw in USDT</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {message ? (
          <div className="text-center py-4 space-y-3">
            <div className="text-4xl">✅</div>
            <p className="text-green-400 text-sm">{message}</p>
            <p className="text-gray-400 text-sm">
              New balance: <span className="text-orange-400 font-bold">{balance.toFixed(2)} USDT</span>
            </p>
            <button onClick={onClose} className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="text-gray-400 text-sm">
              Available balance: <span className="text-orange-400 font-bold">{balance.toFixed(2)} USDT</span>
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Amount (USDT)</label>
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

            {/* Network selector — same style as the deposit picker */}
            <div className="relative">
              <label className="text-gray-400 text-sm mb-2 block">Withdrawal network</label>
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
                        setCurrency(c.code);
                        setAddress('');
                        setPickerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                        c.code === currency ? 'bg-orange-500/15 text-orange-300' : 'text-white hover:bg-gray-700'
                      }`}
                    >
                      <CoinBadge c={c} size={6} />
                      <span className="font-semibold text-sm">{c.name}</span>
                      <span className="text-gray-500 text-xs ml-auto">{c.network}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">{selected.network} address</label>
              <input
                type="text"
                value={address}
                placeholder={net?.placeholder || 'Address'}
                onChange={(e) => setAddress(e.target.value)}
                className={`w-full bg-gray-800 border rounded-lg px-4 py-3 text-white text-xs font-mono focus:outline-none ${
                  address.length > 0 && !addressValid
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-gray-700 focus:border-orange-500'
                }`}
              />
              {address.length > 0 && !addressValid && (
                <p className="text-red-400 text-xs mt-1">Invalid {selected.network} address.</p>
              )}
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              onClick={handleWithdraw}
              disabled={loading || !canSubmit}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-40 transition active:scale-95"
            >
              {loading ? '⏳ Processing...' : `Withdraw ${amount} USDT`}
            </button>

            <p className="text-gray-600 text-xs text-center">
              Paid in {selected.name} ({selected.network}) at the current rate. Double-check the address — a mistake is irreversible.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default WithdrawModal;
