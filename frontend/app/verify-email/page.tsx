'use client';

import { useEffect, useState } from 'react';
import { verifyEmail } from '@/lib/api';

export default function VerifyEmailPage() {
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (!token) {
      setState('fail');
      return;
    }
    verifyEmail(token).then((ok) => setState(ok ? 'ok' : 'fail')).catch(() => setState('fail'));
  }, []);

  return (
    <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center p-4">
      <div className="bg-[#1b1c1d] border border-black/40 rounded-2xl p-6 w-full max-w-sm space-y-4 text-center">
        <h1 className="text-[#e50539] font-black italic text-2xl">Aviator</h1>
        {state === 'loading' && <p className="text-gray-400 text-sm">Verifying…</p>}
        {state === 'ok' && (
          <>
            <div className="text-4xl">✅</div>
            <p className="text-gray-200 font-bold">Email address confirmed!</p>
            <a href="/" className="block w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl transition">
              Go to the game
            </a>
          </>
        )}
        {state === 'fail' && (
          <>
            <div className="text-4xl">⚠️</div>
            <p className="text-gray-300 text-sm">Invalid or expired link. Sign in again and resend a verification email.</p>
            <a href="/" className="block w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition">
              Back to the game
            </a>
          </>
        )}
      </div>
    </div>
  );
}
