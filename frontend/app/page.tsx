/**
 * page.tsx
 * Main Aviator game page.
 * Initializes user session, session seed, renders game UI.
 * Socket.IO is managed globally by SocketProvider in layout.tsx.
 */

'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { createUser, getBalance } from '@/lib/api';
import Header from '@/components/Header';
import AviatorCanvas from '@/components/AviatorCanvas';
import BetPanel from '@/components/BetPanel';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function Home() {
  const setUserId     = useGameStore((s) => s.setUserId);
  const setBalance    = useGameStore((s) => s.setBalance);
  const setSessionSeed = useGameStore((s) => s.setSessionSeed);
  const userId        = useGameStore((s) => s.userId);

  // Initialiser la session utilisateur + seed individualisé
  useEffect(() => {
    const init = async () => {
      let storedId = localStorage.getItem('aviator_userId');

      if (!storedId) {
        const user = await createUser();
        storedId = user.userId;
        localStorage.setItem('aviator_userId', storedId);
        setUserId(storedId);
        setBalance(user.balance);
      } else {
        setUserId(storedId);
        const balance = await getBalance(storedId);
        setBalance(balance);
      }

      // Générer ou récupérer le seed de session (unique par session navigateur)
      let seed = sessionStorage.getItem('aviator_sessionSeed');
      if (!seed) {
        try {
          const res = await fetch(`${BASE_URL}/api/session-seed`);
          const data = await res.json();
          seed = data.seed;
          sessionStorage.setItem('aviator_sessionSeed', seed!);
        } catch {
          // Fallback : seed aléatoire côté client
          seed = Math.random().toString(36).slice(2) + Date.now().toString(36);
          sessionStorage.setItem('aviator_sessionSeed', seed);
        }
      }
      setSessionSeed(seed!);
    };

    init().catch(console.error);
  }, [setUserId, setBalance, setSessionSeed]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-5xl mx-auto w-full">
        {/* Canvas du jeu */}
        <div className="flex-1">
          <AviatorCanvas />

          {userId && (
            <p className="text-gray-700 text-xs mt-2 text-center font-mono">
              ID: {userId.slice(0, 8)}...
            </p>
          )}
        </div>

        {/* Panneau de mise */}
        <div className="w-full lg:w-72">
          <BetPanel />
        </div>
      </main>
    </div>
  );
}
