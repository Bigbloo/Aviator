/**
 * Header.tsx
 * Top navigation bar with balance, deposit and withdraw buttons.
 */

'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import DepositModal from './DepositModal';
import WithdrawModal from './WithdrawModal';

const Header = () => {
  const { balance, userId } = useGameStore();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-orange-900/30">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">✈️</span>
          <span className="text-white font-black text-xl tracking-widest">AVIATOR</span>
        </div>

        {/* Balance + actions */}
        <div className="flex items-center gap-3">
          <div className="bg-gray-800 rounded-lg px-3 py-1.5 text-orange-400 font-bold text-sm">
            {balance.toFixed(2)} €
          </div>
          <button
            onClick={() => setShowDeposit(true)}
            className="bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold px-3 py-1.5 rounded-lg transition active:scale-95"
          >
            + Déposer
          </button>
          <button
            onClick={() => setShowWithdraw(true)}
            className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg transition active:scale-95"
          >
            Retirer
          </button>
        </div>
      </header>

      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}
    </>
  );
};

export default Header;
