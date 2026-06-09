/**
 * AgeGate.tsx
 * Mandatory 18+ confirmation shown once per browser before the site is usable.
 */

'use client';

import { useEffect, useState } from 'react';

const KEY = 'aviator_age_ok';

const AgeGate = () => {
  const [mounted, setMounted] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setOk(localStorage.getItem(KEY) === 'true');
    setMounted(true);
  }, []);

  if (!mounted || ok) return null;

  const accept = () => {
    localStorage.setItem(KEY, 'true');
    setOk(true);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0e0e10] flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-[#1b1c1d] border border-black/40 rounded-2xl p-6 text-center space-y-4">
        <div className="text-5xl">🔞</div>
        <h2 className="text-white font-black text-xl">Vérification de l’âge</h2>
        <p className="text-gray-300 text-sm">
          Ce site propose des jeux d’argent. Tu dois avoir{' '}
          <b className="text-white">18 ans ou plus</b> et accepter nos{' '}
          <a href="/terms" className="underline text-orange-400">CGU</a> et notre{' '}
          <a href="/privacy" className="underline text-orange-400">Politique de confidentialité</a>.
        </p>
        <p className="text-gray-500 text-xs">
          Jouer comporte des risques : endettement, isolement, dépendance.{' '}
          <a href="/responsible-gambling" className="underline">Jouer responsable</a>.
        </p>
        <div className="flex gap-2 pt-1">
          <a
            href="https://www.google.com"
            className="flex-1 py-2.5 rounded-xl bg-[#2c2d30] text-gray-300 text-sm font-bold flex items-center justify-center"
          >
            J’ai moins de 18 ans
          </a>
          <button
            onClick={accept}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold transition active:scale-95"
          >
            J’ai 18 ans ou plus
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgeGate;
