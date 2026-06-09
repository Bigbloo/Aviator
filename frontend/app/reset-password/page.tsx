'use client';

import { useEffect, useState } from 'react';
import { resetPassword } from '@/lib/api';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || '';
    setToken(t);
  }, []);

  const canSubmit = password.length >= 8 && password === confirm && !!token;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center p-4">
      <div className="bg-[#1b1c1d] border border-black/40 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h1 className="text-[#e50539] font-black italic text-2xl text-center">Aviator</h1>
        <h2 className="text-white font-bold text-lg text-center">Nouveau mot de passe</h2>

        {done ? (
          <div className="text-center space-y-3">
            <div className="text-4xl">✅</div>
            <p className="text-gray-300 text-sm">Ton mot de passe a été réinitialisé.</p>
            <a href="/" className="block w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl transition">
              Aller au jeu
            </a>
          </div>
        ) : !token ? (
          <p className="text-gray-400 text-sm text-center">Lien invalide ou expiré.</p>
        ) : (
          <>
            <input
              type="password"
              value={password}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Nouveau mot de passe (8 min.)"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500"
            />
            <input
              type="password"
              value={confirm}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Confirme le mot de passe"
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className={`w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-white focus:outline-none ${
                confirm.length > 0 && password !== confirm ? 'border-red-500' : 'border-gray-700 focus:border-orange-500'
              }`}
            />
            {confirm.length > 0 && password !== confirm && (
              <p className="text-red-400 text-xs">Les mots de passe ne correspondent pas.</p>
            )}
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              onClick={submit}
              disabled={loading || !canSubmit}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-40 transition active:scale-95"
            >
              {loading ? '⏳ ...' : 'Réinitialiser'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
