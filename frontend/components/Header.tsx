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
import ProvablyFairModal from './ProvablyFairModal';
import PromoBanner from './PromoBanner';
import WelcomeOfferModal from './WelcomeOfferModal';
import { setMuted } from '@/lib/sound';
import { isDemoLocal } from '@/lib/api';
import { ttqTrack } from '@/lib/tiktokPixel';

const Header = () => {
  const { balance, username } = useGameStore();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showFair, setShowFair] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  // Real money moves require a registered account (anonymous players must sign
  // up first). Admin demo sessions are exempt.
  const requireAccount = () => !!username || isDemoLocal();
  const goDeposit = () => {
    ttqTrack('ClickButton', { content_name: 'Deposit' });
    return requireAccount() ? setShowDeposit(true) : setShowAuth(true);
  };
  const goWithdraw = () => (requireAccount() ? setShowWithdraw(true) : setShowAuth(true));

  return (
    <>
      <header className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 bg-[#1b1c1d] border-b border-black/40">
        {/* Logo */}
        <button onClick={() => setShowAuth(true)} className="flex items-center shrink-0" title="Aviator">
          <span className="text-[#e50539] font-black italic text-xl sm:text-2xl tracking-tight select-none drop-shadow-[0_0_8px_rgba(229,5,57,0.5)]">
            Aviator
          </span>
        </button>

        {/* Promo banner — header center on desktop (no room on mobile, see below) */}
        <div className="flex-1 min-w-0 flex justify-center sm:pl-20">
          <div className="hidden sm:flex w-full justify-center min-w-0">
            <PromoBanner onClaim={() => setShowAuth(true)} />
          </div>
        </div>

        {/* Balance + actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Balance pill */}
          <div className="flex items-center gap-2 bg-[#101112] rounded-full pl-3 pr-1 py-1">
            <span className="text-white font-bold text-sm tabular-nums">
              {balance.toFixed(2)} <span className="text-gray-400 text-xs font-semibold">USDT</span>
            </span>
            <button
              onClick={goDeposit}
              className="bg-[#28a909] hover:bg-[#23950a] text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full transition active:scale-95 whitespace-nowrap"
              title="Deposit"
            >
              Deposit
            </button>
          </div>

          <button
            onClick={toggleMute}
            className="bg-[#2c2d30] hover:bg-[#3a3b3e] text-white text-base w-8 h-8 flex items-center justify-center rounded-full transition active:scale-95"
            title={muted ? 'Unmute' : 'Mute'}
            aria-label={muted ? 'Unmute' : 'Mute'}
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
                    <span className="truncate">{username || 'Create an account'}</span>
                  </button>
                  <button
                    onClick={() => { goDeposit(); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-[#2c2d30] flex items-center gap-2"
                  >
                    💰 Deposit
                  </button>
                  <button
                    onClick={() => { goWithdraw(); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-[#2c2d30] flex items-center gap-2"
                  >
                    💸 Withdraw
                  </button>
                  <button
                    onClick={() => { setShowFair(true); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-[#2c2d30] flex items-center gap-2"
                  >
                    🛡️ Provably Fair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Promo banner — full-width strip under the header on mobile */}
      <div className="sm:hidden px-2 py-1.5 bg-[#1b1c1d] border-b border-black/40">
        <PromoBanner onClaim={() => setShowAuth(true)} />
      </div>

      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showFair && <ProvablyFairModal onClose={() => setShowFair(false)} />}

      {/* First-connection welcome offer (only for visitors who aren't signed in) */}
      {!username && <WelcomeOfferModal onClaim={() => setShowAuth(true)} />}
    </>
  );
};

export default Header;
