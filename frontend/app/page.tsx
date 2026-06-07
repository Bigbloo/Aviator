/**
 * page.tsx
 * Main Aviator game page.
 * Initializes user session, connects to Socket.IO, renders game UI.
 */

'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { createUser, getBalance } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import Header from '@/components/Header';
import AviatorCanvas from '@/components/AviatorCanvas';
import BetPanel from '@/components/BetPanel';
import DepositModal from '@/components/DepositModal';

export default function Home() {
  const { setUserId, setBalance, userId, balance } = useGameStore();
  const [showDeposit, setShowDeposit] = useState(false);

  // Connect to backend Socket.IO
  useSocket();

  // Initialize user session from localStorage
  useEffect(() => {
    const init = async () => {
      let storedId = localStorage.getItem('aviator_userId');

      if (!storedId) {
        // First visit: create new user
        const user = await createUser();
        storedId = user.userId;
        localStorage.setItem('aviator_userId', storedId);
        setUserId(storedId);
        setBalance(user.balance);
      } else {
        setUserId(storedId);
        // Fetch current balance
        const balance = await getBalance(storedId);
        setBalance(balance);
      }
    };

    init().catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-5xl mx-auto w-full">
        {/* Game canvas */}
        <div className="flex-1">
          <AviatorCanvas />

          {/* User ID display */}
          {userId && (
            <p className="text-gray-700 text-xs mt-2 text-center font-mono">
              ID: {userId.slice(0, 8)}...
            </p>
          )}
        </div>

        {/* Bet panel */}
        <div className="w-full lg:w-72 space-y-3">
          <button
            onClick={() => setShowDeposit(true)}
            className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 transition active:scale-95"
          >
            💳 Déposer des fonds
          </button>
          <BetPanel />
        </div>
      </main>

      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
    </div>
  );
}
