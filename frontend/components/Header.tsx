/**
 * Header.tsx
 * Top bar — Spribe-style: red italic Aviator logo, USDT balance pill, deposit
 * and account actions.
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
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  return (
    <>
      <header className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#1b1c1d] border-b border-black/40 gap-2">
        {/* Logo */}
        <button onClick={() => setShowAuth(true)} className="flex items-center shrink-0" title="Aviator">
          <span className="text-[#e50539] font-black italic text-xl sm:text-2xl tracking-tight select-none drop-shadow-[0_0_8px_rgba(229,5,57,0.5)]">
            Aviator
          </span>
        </button>

        {/* Balance + actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Balance pill */}
          <div className="flex items-center gap-2 bg-[#101112] rounded-full pl-3 pr-1 py-1">
            <span className="text-white font-bold text-sm tabular-nums">
              {balance.toFixed(2)} <span className="text-gray-400 text-xs font-semibold">USDT</span>
            </span>
            <button
              onClick={() => setShowDeposit(true)}
              className="bg-[#28a909] hover:bg-[#23950a] text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full transition active:scale-95 whitespace-nowrap"
              title="Déposer"
            >
              Dépôt
            </button>
          </div>

          <button
            onClick={toggleMute}
            className="bg-[#2c2d30] hover:bg-[#3a3b3e] text-white text-base w-8 h-8 flex items-center justify-center rounded-full transition active:scale-95"
            title={muted ? 'Activer le son' : 'Couper le son'}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
          >
            {muted ? '🔇' : '🔊'}
          </button>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="bg-[#2c2d30] hover:bg-[#3a3b3e] text-white w-8 h-8 flex items-center justify-center rounded-full transition active:scale-95"
              aria-label="Menu"
            >
              ☰
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-44 bg-[#1b1c1d] border border-black/40 rounded-xl shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => { setShowAuth(true); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-[#2c2d30] flex items-center gap-2"
                  >
                    <span>{username ? '👤' : '➕'}</span>
                    <span className="truncate">{username || 'Créer un compte'}</span>
                  </button>
                  <button
                    onClick={() => { setShowDeposit(true); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-[#2c2d30] flex items-center gap-2"
                  >
                    💰 Déposer
                  </button>
                  <button
                    onClick={() => { setShowWithdraw(true); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-[#2c2d30] flex items-center gap-2"
                  >
                    💸 Retirer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
};

export default Header;
