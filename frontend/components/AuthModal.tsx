/**
 * AuthModal.tsx
 * Account creation (pseudo + email + password) and login (email-or-pseudo + password).
 */

'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { register, login } from '@/lib/api';

interface Props {
  onClose: () => void;
}

const AuthModal = ({ onClose }: Props) => {
  const { setUserId, setUsername, setBalance } = useGameStore();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [username, setUsernameLocal] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agree, setAgree] = useState(false);

  const canSubmit =
    mode === 'register'
      ? username.trim().length >= 3 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
        password.length >= 8 &&
        password === passwordConfirm &&
        firstName.trim().length >= 1 &&
        lastName.trim().length >= 1 &&
        address.trim().length >= 5 &&
        agree
      : identifier.trim().length >= 3 && password.length >= 1;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (mode === 'register' && password !== passwordConfirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data =
        mode === 'register'
          ? await register({
              username: username.trim(),
              email: email.trim(),
              password,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              address: address.trim(),
            })
          : await login(identifier.trim(), password);

      // Token is persisted inside register()/login(); keep userId for display.
      localStorage.setItem('aviator_userId', data.userId);
      setUserId(data.userId);
      setUsername(data.username);
      setBalance(data.balance);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: 'register' | 'login') => {
    setMode(m);
    setError('');
    setPassword('');
    setPasswordConfirm('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-orange-900/40 rounded-2xl p-6 w-full max-w-sm space-y-4 my-8">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-bold text-xl">
            {mode === 'register' ? '👤 Créer un compte' : '🔑 Se connecter'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">
            ✕
          </button>
        </div>

        <div className="flex bg-gray-800 rounded-lg p-1 text-sm">
          <button
            onClick={() => switchMode('register')}
            className={`flex-1 py-1.5 rounded-md font-bold transition ${
              mode === 'register' ? 'bg-orange-500 text-white' : 'text-gray-400'
            }`}
          >
            Créer un compte
          </button>
          <button
            onClick={() => switchMode('login')}
            className={`flex-1 py-1.5 rounded-md font-bold transition ${
              mode === 'login' ? 'bg-orange-500 text-white' : 'text-gray-400'
            }`}
          >
            Se connecter
          </button>
        </div>

        {mode === 'register' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Prénom</label>
                <input
                  type="text"
                  value={firstName}
                  maxLength={80}
                  autoComplete="given-name"
                  placeholder="Jean"
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Nom</label>
                <input
                  type="text"
                  value={lastName}
                  maxLength={80}
                  autoComplete="family-name"
                  placeholder="Dupont"
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Pseudo</label>
              <input
                type="text"
                value={username}
                maxLength={20}
                autoComplete="username"
                placeholder="3 à 20 caractères"
                onChange={(e) => setUsernameLocal(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                maxLength={254}
                autoComplete="email"
                placeholder="toi@exemple.com"
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Adresse</label>
              <textarea
                value={address}
                maxLength={250}
                autoComplete="street-address"
                placeholder="12 rue de la Paix, 75002 Paris, France"
                rows={2}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500 resize-none"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Email ou pseudo</label>
            <input
              type="text"
              value={identifier}
              autoComplete="username"
              placeholder="toi@exemple.com ou MonPseudo"
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500"
            />
          </div>
        )}

        <div>
          <label className="text-gray-400 text-sm mb-1 block">Mot de passe</label>
          <input
            type="password"
            value={password}
            maxLength={128}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            placeholder={mode === 'register' ? '8 caractères minimum' : 'Mot de passe'}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => mode === 'login' && e.key === 'Enter' && handleSubmit()}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500"
          />
        </div>

        {mode === 'register' && (
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Confirmer le mot de passe</label>
            <input
              type="password"
              value={passwordConfirm}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Retape le mot de passe"
              onChange={(e) => setPasswordConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className={`w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-white focus:outline-none ${
                passwordConfirm.length > 0 && password !== passwordConfirm
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-gray-700 focus:border-orange-500'
              }`}
            />
            {passwordConfirm.length > 0 && password !== passwordConfirm && (
              <p className="text-red-400 text-xs mt-1">Les mots de passe ne correspondent pas.</p>
            )}
          </div>
        )}

        {mode === 'register' && (
          <label className="flex items-start gap-2 text-[11px] text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-orange-500 shrink-0"
            />
            <span>
              Je certifie avoir <b className="text-gray-200">18 ans ou plus</b> et j’accepte les{' '}
              <a href="/terms" target="_blank" className="underline text-orange-400">CGU</a> et la{' '}
              <a href="/privacy" target="_blank" className="underline text-orange-400">Politique de confidentialité</a>.
            </span>
          </label>
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || !canSubmit}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-40 transition active:scale-95"
        >
          {loading
            ? '⏳ Patiente...'
            : mode === 'register'
            ? '✅ Créer mon compte'
            : '🔑 Connexion'}
        </button>
      </div>
    </div>
  );
};

export default AuthModal;
