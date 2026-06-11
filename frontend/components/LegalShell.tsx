/**
 * LegalShell.tsx
 * Shared layout for the legal pages (terms, privacy, responsible gambling).
 */

import type { ReactNode } from 'react';

const LegalShell = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="min-h-screen bg-[#0e0e10] text-gray-300">
    <header className="bg-[#1b1c1d] border-b border-black/40 px-4 py-3 flex items-center gap-3">
      <a href="/" className="text-[#e50539] font-black italic text-xl tracking-tight">Aviator</a>
      <a href="/" className="ml-auto text-sm text-gray-400 hover:text-white">← Back to game</a>
    </header>
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-white font-black text-2xl mb-1">{title}</h1>
      <p className="text-[11px] text-gray-600 mb-6">
        Template document — must be reviewed by a lawyer before real operation.
      </p>
      <div className="text-sm leading-relaxed space-y-4 [&_h2]:text-white [&_h2]:font-bold [&_h2]:text-base [&_h2]:mt-6 [&_a]:text-orange-400 [&_a]:underline">
        {children}
      </div>
      <footer className="mt-10 pt-6 border-t border-black/40 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
        <span className="font-bold text-amber-500">18+</span>
        <a href="/terms" className="hover:text-gray-400">Terms</a>
        <a href="/privacy" className="hover:text-gray-400">Privacy</a>
        <a href="/responsible-gambling" className="hover:text-gray-400">Responsible gambling</a>
      </footer>
    </main>
  </div>
);

export default LegalShell;
