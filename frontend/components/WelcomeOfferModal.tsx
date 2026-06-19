/**
 * WelcomeOfferModal.tsx
 * One-time welcome-offer popup shown on a visitor's first connection (before
 * they sign up). Mirrors the header PromoBanner offer. Dismissed state is
 * persisted so it only appears once per visitor.
 */

'use client';

import { useEffect, useState } from 'react';
import { ttqTrack } from '@/lib/tiktokPixel';

const SEEN_KEY = 'aviator_welcome_seen';

const WelcomeOfferModal = ({ onClaim }: { onClaim?: () => void }) => {
  const [open, setOpen] = useState(false);

  // Show once per visitor, shortly after the first load.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(SEEN_KEY) === 'true') return;
    const t = setTimeout(() => {
      setOpen(true);
      ttqTrack('ViewContent', { content_name: 'WelcomeOffer' });
    }, 900);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem(SEEN_KEY, 'true');
    setOpen(false);
  };

  const claim = () => {
    localStorage.setItem(SEEN_KEY, 'true');
    ttqTrack('ClickButton', { content_name: 'WelcomeOfferClaim' });
    setOpen(false);
    onClaim?.();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-gray-900 border border-amber-500/40 p-6 text-center space-y-4 shadow-2xl shadow-amber-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-gray-500 hover:text-white text-xl leading-none"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="text-5xl">🎁</div>

        <h2 className="text-white font-black text-2xl leading-tight">
          Welcome bonus
        </h2>

        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-xl py-3 px-4">
          <p className="text-black font-black text-3xl tracking-tight">50 USDT</p>
          <p className="text-black/80 font-bold text-xs uppercase tracking-wide">free on sign-up</p>
        </div>

        <p className="text-gray-400 text-sm">
          Create your account to claim your welcome bonus and start playing.
        </p>

        <button
          onClick={claim}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 transition active:scale-95"
        >
          Claim my 50 USDT
        </button>

        <button
          onClick={dismiss}
          className="w-full text-gray-500 hover:text-gray-300 text-xs"
        >
          Maybe later
        </button>

        <p className="text-gray-600 text-[10px] leading-snug">
          18+ · Gambling involves risk. Bonus terms apply.
        </p>
      </div>
    </div>
  );
};

export default WelcomeOfferModal;
