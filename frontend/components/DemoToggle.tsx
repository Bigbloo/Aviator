/**
 * DemoToggle.tsx
 * Near-invisible owner control (bottom corner). Toggles an ADMIN-ONLY demo for
 * THIS browser: when on, money calls carry the admin token and the backend
 * simulates deposits/withdrawals — only for the admin. Everyone else stays on
 * the real money layer regardless of this flag.
 */

'use client';

import { useState } from 'react';
import { adminPing, isDemoLocal, DEMO_FLAG_KEY } from '@/lib/api';

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
    const ok = await adminPing(token).catch(() => false);
    if (!ok) {
      localStorage.removeItem(ADMIN_KEY);
      showFlash('Token invalide');
      return null;
    }
    localStorage.setItem(ADMIN_KEY, token);
    return token;
  };

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await ensureToken();
      if (!token) return;
      const next = !isDemoLocal();
      localStorage.setItem(DEMO_FLAG_KEY, next ? 'true' : 'false');
      showFlash(next ? '🟡 DÉMO admin (cette session)' : '🟢 Mode réel');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-2 right-2 z-[60] flex items-center gap-2 select-none">
      {flash && (
        <span className="text-[11px] font-bold text-gray-100 bg-[#1b1c1d] border border-black/40 rounded-md px-2 py-1 shadow-lg">
          {flash}
        </span>
      )}
      {/* Very discreet: a barely-there dot, brightens slightly on hover. */}
      <button
        onClick={handleClick}
        aria-label="·"
        title=""
        className="w-3 h-3 rounded-full bg-white/[0.04] hover:bg-white/40 transition-colors duration-200 cursor-pointer"
      />
    </div>
  );
};

export default DemoToggle;
