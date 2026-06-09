/**
 * DemoToggle.tsx
 * A deliberately near-invisible owner control in the bottom corner. Click it to
 * flip the whole app between DEMO (simulated money) and LIVE. Protected by the
 * admin token — a normal player who stumbles on it can't toggle anything.
 */

'use client';

import { useState } from 'react';
import { adminGetConfig, adminSetDemo } from '@/lib/api';

const ADMIN_KEY = 'aviator_admin_token';

const DemoToggle = () => {
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  };

  const ensureToken = async (): Promise<string | null> => {
    let token = localStorage.getItem(ADMIN_KEY) || '';
    if (!token) {
      token = (window.prompt('Token admin :') || '').trim();
      if (!token) return null;
    }
    try {
      await adminGetConfig(token); // validates
      localStorage.setItem(ADMIN_KEY, token);
      return token;
    } catch {
      localStorage.removeItem(ADMIN_KEY);
      showFlash('Token invalide');
      return null;
    }
  };

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await ensureToken();
      if (!token) return;
      const cfg = await adminGetConfig(token);
      const next = !cfg.demo;
      const res = await adminSetDemo(token, next);
      showFlash(res.demo ? '🟡 MODE DÉMO activé' : '🟢 MODE RÉEL activé');
    } catch {
      showFlash('Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-1 right-1 z-50 flex items-center gap-2 select-none">
      {flash && (
        <span className="text-[11px] font-bold text-gray-200 bg-[#1b1c1d] border border-black/40 rounded-md px-2 py-1 shadow-lg">
          {flash}
        </span>
      )}
      {/* Near-invisible hit target: ~0 opacity, faintly visible on hover. */}
      <button
        onClick={handleClick}
        aria-label="."
        title=""
        className="w-4 h-4 rounded-full bg-gray-500/0 hover:bg-gray-500/30 transition-colors duration-200 cursor-default"
      />
    </div>
  );
};

export default DemoToggle;
