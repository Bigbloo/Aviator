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
  adminListUsers,
  adminExportUsersCsv,
  type AdminWithdrawal,
  type AdminUser,
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
  pending_review: 'Pending',
  processing: 'Sending',
  completed: 'Approved / sent',
  rejected: 'Rejected',
  failed: 'Failed',
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
  const [view, setView] = useState<'withdrawals' | 'players'>('withdrawals');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersError, setUsersError] = useState('');
  const [exporting, setExporting] = useState(false);

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
        setError(e instanceof Error ? e.message : 'Error');
      }
    },
    []
  );

  useEffect(() => {
    if (authed && token) load(token, filter);
  }, [authed, token, filter, load]);

  const loadUsers = useCallback(async (tk: string) => {
    try {
      const data = await adminListUsers(tk);
      setUsers(data.users);
      setUsersError('');
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : 'Error');
    }
  }, []);

  useEffect(() => {
    if (authed && token && view === 'players') loadUsers(token);
  }, [authed, token, view, loadUsers]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const blob = await adminExportUsersCsv(token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aviator-players-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

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
      setError('Invalid admin token.');
    }
  };

  const handleMarkPaid = async (w: AdminWithdrawal) => {
    const txid = prompt(
      `Manual payment — send the equivalent of ${w.amount} USDT in ${w.network} to:\n${w.address}\n\nThen paste the transaction hash (txid) here:`,
      ''
    );
    if (txid === null) return;
    if (txid.trim().length < 6) {
      alert('Invalid txid.');
      return;
    }
    setBusy(w.id);
    try {
      await adminMarkPaidWithdrawal(token, w.id, txid.trim());
      await load(token, filter);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async (w: AdminWithdrawal) => {
    const note = prompt(`Reject the withdrawal of ${w.amount} USDT?\nThe balance will be credited back to the player.\n\nReason (optional):`, '');
    if (note === null) return;
    setBusy(w.id);
    try {
      await adminRejectWithdrawal(token, w.id, note);
      await load(token, filter);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
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
          <p className="text-gray-400 text-sm">Enter the administrator token to manage withdrawals.</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Admin token"
            className="w-full bg-[#101112] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-400 transition active:scale-95"
          >
            Access
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white">
      <header className="flex items-center justify-between px-4 py-3 bg-[#1b1c1d] border-b border-black/40 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-lg flex items-center gap-2">
            🛡️ {view === 'withdrawals' ? 'Withdrawal review' : 'Players'}
            {view === 'withdrawals' && pendingCount > 0 && (
              <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount} pending</span>
            )}
          </h1>
          <div className="inline-flex bg-[#101112] rounded-full p-0.5 text-sm">
            <button
              onClick={() => setView('withdrawals')}
              className={`px-3 py-1 rounded-full transition ${view === 'withdrawals' ? 'bg-[#3a3b3e] text-white' : 'text-gray-400'}`}
            >
              Withdrawals
            </button>
            <button
              onClick={() => setView('players')}
              className={`px-3 py-1 rounded-full transition ${view === 'players' ? 'bg-[#3a3b3e] text-white' : 'text-gray-400'}`}
            >
              Players
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === 'withdrawals' ? (
            <>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'pending_review' | '')}
                className="bg-[#101112] border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              >
                <option value="pending_review">Pending</option>
                <option value="">All</option>
              </select>
              <button onClick={() => load(token, filter)} className="bg-[#2c2d30] hover:bg-[#3a3b3e] px-3 py-1.5 rounded-lg text-sm">↻</button>
            </>
          ) : (
            <>
              <button
                onClick={handleExportCsv}
                disabled={exporting || users.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg text-sm transition active:scale-95"
              >
                {exporting ? '…' : '⬇ Export CSV'}
              </button>
              <button onClick={() => loadUsers(token)} className="bg-[#2c2d30] hover:bg-[#3a3b3e] px-3 py-1.5 rounded-lg text-sm">↻</button>
            </>
          )}
          <button onClick={logout} className="bg-[#2c2d30] hover:bg-[#3a3b3e] px-3 py-1.5 rounded-lg text-sm">Sign out</button>
        </div>
      </header>

      {view === 'players' ? (
        <main className="p-4 max-w-6xl mx-auto space-y-3">
          {usersError && <p className="text-red-400 text-sm">{usersError}</p>}
          <p className="text-gray-500 text-sm">{users.length} registered player{users.length === 1 ? '' : 's'}</p>
          {users.length === 0 && !usersError && <p className="text-gray-500 text-center py-12">No registered players yet.</p>}

          {users.length > 0 && (
            <div className="overflow-x-auto bg-[#1b1c1d] border border-black/40 rounded-2xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs uppercase border-b border-black/40">
                    <th className="px-4 py-2.5">Player</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Full name</th>
                    <th className="px-4 py-2.5">Address</th>
                    <th className="px-4 py-2.5 text-right">Balance</th>
                    <th className="px-4 py-2.5">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-black/20 hover:bg-black/20">
                      <td className="px-4 py-2.5 font-semibold text-white">{u.username || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-300">{u.email || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-300">{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-400 max-w-xs truncate" title={u.address || ''}>{u.address || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-orange-400 font-bold tabular-nums">{u.balance.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      ) : (
      <main className="p-4 max-w-5xl mx-auto space-y-3">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {rows.length === 0 && <p className="text-gray-500 text-center py-12">No {filter === 'pending_review' ? 'pending ' : ''}withdrawals.</p>}

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
                <p className="text-gray-500 text-xs mt-1">Requested on {fmtDate(w.created_at)}</p>
              </div>

              {/* Actions */}
              {w.status === 'pending_review' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMarkPaid(w)}
                    disabled={busy === w.id}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm transition active:scale-95"
                  >
                    {busy === w.id ? '…' : '✓ Mark as paid'}
                  </button>
                  <button
                    onClick={() => handleReject(w)}
                    disabled={busy === w.id}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm transition active:scale-95"
                  >
                    ✕ Reject
                  </button>
                </div>
              )}
            </div>

            {/* KYC / compliance details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 pt-3 border-t border-black/40 text-sm">
              <Detail label="Player" value={w.username || '(anonymous)'} />
              <Detail label="Email" value={w.email || '—'} />
              <Detail label="Full name" value={[w.first_name, w.last_name].filter(Boolean).join(' ') || '—'} />
              <Detail label="Postal address" value={w.user_address || '—'} />
              <Detail label="Payout network" value={w.network} />
              <Detail label={`${w.network} address`} value={w.address} mono />
              {w.txid && <Detail label="Tx" value={w.txid} mono />}
              {w.note && <Detail label="Note" value={w.note} />}
            </div>
          </div>
        ))}
      </main>
      )}
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
