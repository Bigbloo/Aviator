/**
 * page.tsx
 * Main Aviator game page.
 * Initializes user session, connects to Socket.IO, renders game UI.
 */

'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { createUser, getBalance, getToken, AuthError } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import Header from '@/components/Header';
import HistoryBar from '@/components/HistoryBar';
import AviatorCanvas from '@/components/AviatorCanvas';
import BetPanel from '@/components/BetPanel';
import LiveBets from '@/components/LiveBets';
import TopWinners from '@/components/TopWinners';

export default function Home() {
  const { setUserId, setUsername, setBalance } = useGameStore();

  // Connect to backend Socket.IO
  useSocket();

  // Initialize the session. The session token is the source of truth: with a
  // valid token we resume the account; otherwise (first visit, or a stale token
  // from before auth existed) we create a fresh anonymous account.
  useEffect(() => {
    const startAnon = async () => {
      const user = await createUser();
      localStorage.setItem('aviator_userId', user.userId);
      setUserId(user.userId);
      setBalance(user.balance);
      setUsername(null);
    };

    const init = async () => {
      if (!getToken()) {
        await startAnon();
        return;
      }
      try {
        const me = await getBalance();
        const storedId = localStorage.getItem('aviator_userId');
        if (storedId) setUserId(storedId);
        setBalance(me.balance);
        setUsername(me.username);
      } catch (err) {
        // Token rejected/expired → fall back to a fresh anon session.
        if (err instanceof AuthError) await startAnon();
        else throw err;
      }
    };

    init().catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-[#0e0e10] flex flex-col">
      <Header />

      <main className="flex-1 w-full p-2 gap-2
        grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_320px]
        lg:h-[calc(100vh-56px)]">

        {/* LEFT — All Bets sidebar (desktop only here) */}
        <aside className="hidden lg:block lg:h-full lg:min-h-0">
          <LiveBets />
        </aside>

        {/* CENTER — history + game + bet panels */}
        <section className="min-w-0 flex flex-col gap-2 lg:h-full lg:min-h-0">
          <div className="rounded-2xl overflow-hidden border border-black/30 flex flex-col flex-1 min-h-[42vh] lg:min-h-[260px]">
            <HistoryBar />
            <div className="relative flex-1 min-h-0 bg-[#0d1117]">
              <AviatorCanvas />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
            <BetPanel slot={1} />
            <BetPanel slot={2} />
          </div>

          {/* On mobile, the bets + winners stack below the game */}
          <div className="lg:hidden space-y-2">
            <TopWinners />
            <LiveBets />
          </div>
        </section>

        {/* RIGHT — Top Winners (replaces chat on web) */}
        <aside className="hidden lg:block lg:h-full lg:min-h-0">
          <TopWinners />
        </aside>
      </main>
    </div>
  );
}
