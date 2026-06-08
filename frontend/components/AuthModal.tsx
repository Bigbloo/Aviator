/**
 * AuthModal.tsx
 * Account creation / login by username (demo mode — no password).
 */

'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { register, login } from '@/lib/api';

interface Props {
  onClose: () => void;
}

const AuthModal = ({ onClose }: Props) => {
  const { userId, setUserId, setUsername, setBalance } = useGameStore();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setError('Le pseudo doit faire au moins 3 caractères.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data =
        mode === 'register'
          ? await register(trimmed, userId)
          : await login(trimmed);

      // Persist + update store
      localStorage.setItem('aviator_userId', data.userId);
      setUserId(data.userId);
      setUsername(data.username);
      setBalance(data.balance);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-orange-900/40 rounded-2xl p-6 w-full max-w-sm space-y-5">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-bold text-xl">
            {mode === 'register' ? '👤 Créer un compte' : '🔑 Se connecter'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">
            ✕
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-gray-800 rounded-lg p-1 text-sm">
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-1.5 rounded-md font-bold transition ${
              mode === 'register' ? 'bg-orange-500 text-white' : 'text-gray-400'
            }`}
          >
            Créer un compte
          </button>
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-1.5 rounded-md font-bold transition ${
              mode === 'login' ? 'bg-orange-500 text-white' : 'text-gray-400'
            }`}
          >
            Se connecter
          </button>
        </div>

        <div>
          <label className="text-gray-400 text-sm mb-2 block">Pseudo</label>
          <input
            type="text"
            value={name}
            maxLength={20}
            placeholder="Ton pseudo (3-20 caractères)"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-center font-bold focus:outline-none focus:border-orange-500"
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || name.trim().length < 3}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-40 transition active:scale-95"
        >
          {loading
            ? '⏳ Patiente...'
            : mode === 'register'
            ? '✅ Créer mon compte'
            : '🔑 Connexion'}
        </button>

        <p className="text-gray-600 text-[11px] text-center">
          Mode démo · aucun mot de passe requis · jetons fictifs
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
