/**
 * Header.tsx
 * Top navigation bar with balance, deposit and withdraw buttons.
 */

'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import DepositModal from './DepositModal';
import WithdrawModal from './WithdrawModal';
import AuthModal from './AuthModal';
import { setMuted } from '@/lib/sound';

const Header = () => {
  const { balance, username } = useGameStore();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [muted, setMutedState] = useState(false);

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  return (
    <>
      <header className="flex items-center justify-between px-3 sm:px-4 py-3 bg-gray-950 border-b border-orange-900/30 gap-2">
        {/* Logo */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xl sm:text-2xl">✈️</span>
          <span className="hidden sm:inline text-white font-black text-base sm:text-xl tracking-wider sm:tracking-widest">AVIATOR</span>
        </div>

        {/* Balance + actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={() => setShowAuth(true)}
            className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-white text-xs sm:text-sm font-bold px-2 sm:px-3 py-1.5 rounded-lg transition active:scale-95 whitespace-nowrap max-w-[90px] sm:max-w-[120px]"
            title={username ? 'Changer de compte' : 'Créer un compte'}
          >
            <span>{username ? '👤' : '➕'}</span>
            <span className="truncate hidden sm:inline">{username || 'Compte'}</span>
          </button>
          <div className="bg-gray-800 rounded-lg px-2 sm:px-3 py-1.5 text-orange-400 font-bold text-xs sm:text-sm whitespace-nowrap">
            {balance.toFixed(2)} €
          </div>
          <button
            onClick={toggleMute}
            className="bg-gray-800 hover:bg-gray-700 text-white text-base px-2 py-1.5 rounded-lg transition active:scale-95"
            title={muted ? 'Activer le son' : 'Couper le son'}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={() => setShowDeposit(true)}
            className="bg-orange-500 hover:bg-orange-400 text-white text-xs sm:text-sm font-bold px-2 sm:px-3 py-1.5 rounded-lg transition active:scale-95 whitespace-nowrap"
            title="Déposer"
          >
            <span className="sm:hidden">+</span>
            <span className="hidden sm:inline">+ Déposer</span>
          </button>
          <button
            onClick={() => setShowWithdraw(true)}
            className="bg-gray-700 hover:bg-gray-600 text-white text-xs sm:text-sm font-bold px-2 sm:px-3 py-1.5 rounded-lg transition active:scale-95 whitespace-nowrap"
            title="Retirer"
          >
            <span className="sm:hidden">−</span>
            <span className="hidden sm:inline">Retirer</span>
          </button>
        </div>
      </header>

      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
};

export default Header;
