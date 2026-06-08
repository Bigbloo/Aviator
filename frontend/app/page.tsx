/**
 * page.tsx
 * Main Aviator game page.
 * Initializes user session, connects to Socket.IO, renders game UI.
 */

'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { createUser, getBalance } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import Header from '@/components/Header';
import HistoryBar from '@/components/HistoryBar';
import AviatorCanvas from '@/components/AviatorCanvas';
import BetPanel from '@/components/BetPanel';
import LiveBets from '@/components/LiveBets';
import Leaderboard from '@/components/Leaderboard';

export default function Home() {
  const { setUserId, setUsername, setBalance } = useGameStore();

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
        // Fetch current balance + username
        const { balance, username } = await getBalance(storedId);
        setBalance(balance);
        setUsername(username);
      }
    };

    init().catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />
      <HistoryBar />

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-5xl mx-auto w-full">
        {/* Game canvas */}
        <div className="flex-1">
          <AviatorCanvas />

          {/* Live bets table — under the game on desktop (PC) */}
          <div className="hidden lg:block mt-3">
            <LiveBets />
          </div>
        </div>

        {/* Bet panels (double bet) + live feed (mobile) + leaderboard */}
        <div className="w-full lg:w-72 space-y-3">
          <BetPanel slot={1} />
          <BetPanel slot={2} />
          {/* Live bets stays here on mobile/tablet only */}
          <div className="lg:hidden">
            <LiveBets />
          </div>
          <Leaderboard />
        </div>
      </main>
    </div>
  );
}
