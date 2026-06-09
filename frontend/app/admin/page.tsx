/**
 * /admin — Withdrawal review console (compliance).
 * Enter the admin token, review each pending withdrawal alongside the player's
 * KYC info, then Approve (sends on-chain) or Reject (refunds).
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  adminPing,
  adminListWithdrawals,
  adminMarkPaidWithdrawal,
  adminRejectWithdrawal,
  type AdminWithdrawal,
} from '@/lib/api';

const TOKEN_KEY = 'aviator_admin_token';

const statusStyle: Record<string, string> = {
  pending_review: 'bg-amber-500/15 text-amber-300',
  processing: 'bg-sky-500/15 text-sky-300',
  completed: 'bg-emerald-500/15 text-emerald-300',
  rejected: 'bg-red-500/15 text-red-300',
  failed: 'bg-red-500/15 text-red-300',
};
const statusLabel: Record<string, string> = {
  pending_review: 'En attente',
  processing: 'Envoi en cours',
  completed: 'Validé / envoyé',
  rejected: 'Rejeté',
  failed: 'Échec',
};

const fmtDate = (s: number) => new Date(s * 1000).toLocaleString('fr-FR');

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [rows, setRows] = useState<AdminWithdrawal[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter] = useState<'pending_review' | ''>('pending_review');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  // Restore a saved token.
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      adminPing(saved).then((ok) => {
        if (ok) {
          setToken(saved);
          setAuthed(true);
        }
      });
    }
  }, []);

  const load = useCallback(
    async (tk: string, f: string) => {
      try {
        const data = await adminListWithdrawals(tk, f);
        setRows(data.withdrawals);
        setPendingCount(data.pendingCount);
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    },
    []
  );

  useEffect(() => {
    if (authed && token) load(token, filter);
  }, [authed, token, filter, load]);

  // Auto-refresh every 15s.
  useEffect(() => {
    if (!authed || !token) return;
    const id = setInterval(() => load(token, filter), 15000);
    return () => clearInterval(id);
  }, [authed, token, filter, load]);

  const handleLogin = async () => {
    const tk = tokenInput.trim();
    if (!tk) return;
    const ok = await adminPing(tk);
    if (ok) {
      localStorage.setItem(TOKEN_KEY, tk);
      setToken(tk);
      setAuthed(true);
      setError('');
    } else {
      setError('Token admin invalide.');
    }
  };

  const handleMarkPaid = async (w: AdminWithdrawal) => {
    const txid = prompt(
      `Paiement manuel — envoie d'abord ${w.amount} USDT (TRC-20) à :\n${w.address}\n\nPuis colle ici le hash de transaction (txid) :`,
      ''
    );
    if (txid === null) return;
    if (txid.trim().length < 6) {
      alert('txid invalide.');
      return;
    }
    setBusy(w.id);
    try {
      await adminMarkPaidWithdrawal(token, w.id, txid.trim());
      await load(token, filter);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async (w: AdminWithdrawal) => {
    const note = prompt(`Rejeter le retrait de ${w.amount} USDT ?\nLe solde sera recrédité au joueur.\n\nMotif (optionnel) :`, '');
    if (note === null) return;
    setBusy(w.id);
    try {
      await adminRejectWithdrawal(token, w.id, note);
      await load(token, filter);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setAuthed(false);
    setTokenInput('');
    setRows([]);
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center p-4">
        <div className="bg-[#1b1c1d] border border-black/40 rounded-2xl p-6 w-full max-w-sm space-y-4">
          <h1 className="text-white font-bold text-xl">🔐 Console de validation</h1>
          <p className="text-gray-400 text-sm">Entre le token administrateur pour gérer les retraits.</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Token admin"
            className="w-full bg-[#101112] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-400 transition active:scale-95"
          >
            Accéder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white">
      <header className="flex items-center justify-between px-4 py-3 bg-[#1b1c1d] border-b border-black/40">
        <h1 className="font-bold text-lg flex items-center gap-2">
          🛡️ Validation des retraits
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount} en attente</span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'pending_review' | '')}
            className="bg-[#101112] border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          >
            <option value="pending_review">En attente</option>
            <option value="">Tous</option>
          </select>
          <button onClick={() => load(token, filter)} className="bg-[#2c2d30] hover:bg-[#3a3b3e] px-3 py-1.5 rounded-lg text-sm">↻</button>
          <button onClick={logout} className="bg-[#2c2d30] hover:bg-[#3a3b3e] px-3 py-1.5 rounded-lg text-sm">Quitter</button>
        </div>
      </header>

      <main className="p-4 max-w-5xl mx-auto space-y-3">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {rows.length === 0 && <p className="text-gray-500 text-center py-12">Aucun retrait {filter === 'pending_review' ? 'en attente' : ''}.</p>}

        {rows.map((w) => (
          <div key={w.id} className="bg-[#1b1c1d] border border-black/40 rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              {/* Amount + status */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-orange-400">{w.amount.toFixed(2)} USDT</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusStyle[w.status] || 'bg-gray-600/30 text-gray-300'}`}>
                    {statusLabel[w.status] || w.status}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-1">Demandé le {fmtDate(w.created_at)}</p>
              </div>

              {/* Actions */}
              {w.status === 'pending_review' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMarkPaid(w)}
                    disabled={busy === w.id}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm transition active:scale-95"
                  >
                    {busy === w.id ? '…' : '✓ Marquer payé'}
                  </button>
                  <button
                    onClick={() => handleReject(w)}
                    disabled={busy === w.id}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm transition active:scale-95"
                  >
                    ✕ Rejeter
                  </button>
                </div>
              )}
            </div>

            {/* KYC / compliance details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 pt-3 border-t border-black/40 text-sm">
              <Detail label="Joueur" value={w.username || '(anonyme)'} />
              <Detail label="Email" value={w.email || '—'} />
              <Detail label="Nom complet" value={[w.first_name, w.last_name].filter(Boolean).join(' ') || '—'} />
              <Detail label="Adresse postale" value={w.user_address || '—'} />
              <Detail label="Adresse USDT (TRC-20)" value={w.address} mono />
              {w.txid && <Detail label="Tx" value={w.txid} mono />}
              {w.note && <Detail label="Note" value={w.note} />}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="text-gray-500 text-xs">{label}</span>
      <p className={`text-gray-200 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}
