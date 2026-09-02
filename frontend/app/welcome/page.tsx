/**
 * /welcome — Conversion landing page for ad campaigns.
 *
 * Single objective: get the visitor into the game (and, on supported browsers,
 * installed as a PWA). Structure follows the player's decision path — offer →
 * proof it isn't rigged → payment/withdrawal reassurance → objections → CTA.
 *
 * Every claim here is verifiable against the live product: the recent
 * multipliers are pulled from the real /api/fair/rounds endpoint, and the
 * bonus terms match the server logic (50 USDT at 50 deposited, 1x wagering).
 * No fabricated testimonials, no invented player counts.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getFairRounds, type FairRound } from '@/lib/api';
import { ttqTrack } from '@/lib/tiktokPixel';

// Minimal shape of the install prompt event (not in TS lib DOM).
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PLAY_URL = '/';

export default function WelcomePage() {
  const [rounds, setRounds] = useState<FairRound[]>([]);
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  // Real recent crash multipliers — live proof the game is running.
  useEffect(() => {
    getFairRounds()
      .then((r) => setRounds(r.slice(0, 14)))
      .catch(() => {});
  }, []);

  // PWA install: capture the prompt on Chrome/Edge/Android; iOS needs manual steps.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window));
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const handleInstall = async () => {
    ttqTrack('ClickButton', { content_name: 'LP_Install' });
    if (installEvt) {
      await installEvt.prompt();
      await installEvt.userChoice;
      setInstallEvt(null);
      return;
    }
    if (isIOS) setShowIOSHelp(true);
    else window.location.href = PLAY_URL;
  };

  const trackPlay = (where: string) => ttqTrack('ClickButton', { content_name: `LP_Play_${where}` });

  return (
    <div className="min-h-[100dvh] bg-[#0e0e10] text-white overflow-x-hidden">
      {/* ── Sticky top bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#0e0e10]/90 backdrop-blur border-b border-white/5">
        <span className="text-[#e50539] font-black italic text-xl tracking-tight drop-shadow-[0_0_8px_rgba(229,5,57,0.5)]">
          Aviator
        </span>
        <Link
          href={PLAY_URL}
          onClick={() => trackPlay('Header')}
          className="bg-[#28a909] hover:bg-[#23950a] text-white text-sm font-bold px-4 py-2 rounded-full transition active:scale-95"
        >
          Play now
        </Link>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative px-4 pt-10 pb-12 text-center overflow-hidden">
        {/* Sunburst backdrop, echoing the in-game canvas */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, rgba(229,5,57,0.25) 0%, rgba(14,14,16,0) 65%), repeating-conic-gradient(from 0deg at 50% 120%, #141d2a 0deg 6deg, transparent 6deg 14deg)',
          }}
        />
        <div className="relative max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full">
            🎁 100% welcome bonus
          </span>

          <h1 className="mt-5 text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight">
            Cash out before
            <br />
            <span className="text-[#e50539] drop-shadow-[0_0_20px_rgba(229,5,57,0.45)]">the plane flies away.</span>
          </h1>

          <p className="mt-4 text-gray-400 text-base sm:text-lg max-w-lg mx-auto">
            A crash game you can actually verify. Deposit in crypto, watch the multiplier climb,
            and cash out before it crashes.
          </p>

          {/* Primary CTAs */}
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={PLAY_URL}
              onClick={() => trackPlay('Hero')}
              className="group relative px-8 py-4 rounded-2xl font-black text-lg text-white bg-gradient-to-b from-[#5bbf1c] to-[#28a909] hover:from-[#69d122] hover:to-[#2fbf0c] shadow-lg shadow-green-900/40 transition active:scale-95"
            >
              Play free now
              <span className="block text-xs font-semibold opacity-80">No download required</span>
            </Link>
            <button
              onClick={handleInstall}
              className="px-8 py-4 rounded-2xl font-bold text-white bg-white/10 hover:bg-white/15 border border-white/15 transition active:scale-95"
            >
              📲 Install the app
              <span className="block text-xs font-normal opacity-70">Full-screen, one tap away</span>
            </button>
          </div>

          {/* Trust strip — each item is factually true of the product */}
          <div className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-gray-500">
            <span>🛡️ Provably fair</span>
            <span>⚡ Auto-credited deposits</span>
            <span>₿ 6 cryptocurrencies</span>
            <span>🔒 No app store needed</span>
          </div>

          {/* Product visual — placed after the CTAs so the button stays above
              the fold on phones. Priority-loaded: it is the LCP element. */}
          <div className="mt-9 relative mx-auto max-w-xl">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[2rem] bg-[#e50539]/20 blur-3xl"
            />
            <Image
              src="/lp-hero.jpeg"
              alt="The Aviator game on mobile: the multiplier climbing as the plane takes off"
              width={675}
              height={453}
              priority
              className="relative rounded-2xl w-full h-auto shadow-2xl shadow-black/60 ring-1 ring-white/10"
            />
          </div>
        </div>
      </section>

      {/* ── Live proof: real recent multipliers ────────────────────────── */}
      <section className="px-4 pb-12">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-gray-500 text-xs uppercase tracking-widest mb-3">
            Last rounds · live from the game
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {rounds.length === 0
              ? Array.from({ length: 10 }).map((_, i) => (
                  <span key={i} className="h-7 w-16 rounded-full bg-white/5 animate-pulse" />
                ))
              : rounds.map((r) => (
                  <span
                    key={r.roundId}
                    className={`px-3 py-1 rounded-full text-sm font-bold font-mono tabular-nums ${
                      r.crashPoint >= 10
                        ? 'bg-pink-500/15 text-pink-300'
                        : r.crashPoint >= 2
                          ? 'bg-purple-500/15 text-purple-300'
                          : 'bg-sky-500/15 text-sky-300'
                    }`}
                  >
                    {r.crashPoint.toFixed(2)}×
                  </span>
                ))}
          </div>
          <p className="text-center text-gray-600 text-xs mt-3">
            These are the game&apos;s actual last results — each one cryptographically verifiable.
          </p>
        </div>
      </section>

      {/* ── The offer ──────────────────────────────────────────────────── */}
      <section className="px-4 pb-14">
        <div className="max-w-lg mx-auto rounded-3xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent p-6 text-center">
          <p className="text-amber-300 font-bold text-sm uppercase tracking-wide">Welcome offer</p>
          <p className="mt-2 text-4xl font-black">
            Deposit 50 <span className="text-amber-400">→</span> get 50
          </p>
          <p className="mt-1 text-gray-400">
            We double your first 50 USDT deposit. That&apos;s <strong className="text-white">100 USDT</strong> to play with.
          </p>

          <div className="mt-5 rounded-xl bg-black/30 p-4 text-left space-y-2 text-sm">
            <p className="text-emerald-400 font-bold flex items-center gap-2">
              ✓ Only 1× wagering
            </p>
            <p className="text-gray-400">
              Wager the bonus once (50 USDT) and it&apos;s yours to withdraw. Most casinos ask for
              20× to 40× — we ask for one.
            </p>
          </div>

          <Link
            href={PLAY_URL}
            onClick={() => trackPlay('Offer')}
            className="mt-5 block w-full py-3.5 rounded-xl font-black text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 transition active:scale-95"
          >
            Claim the bonus
          </Link>
          <p className="mt-2 text-gray-600 text-[11px]">
            18+ · Bonus credited once 50 USDT is deposited · 1× wagering before withdrawal
          </p>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="px-4 pb-14">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center text-2xl sm:text-3xl font-black mb-8">Three steps. That&apos;s it.</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { n: '1', t: 'Place your bet', d: 'Pick your stake before take-off. You can run two bets at once.' },
              { n: '2', t: 'Watch it climb', d: 'The multiplier rises every second the plane stays in the air.' },
              { n: '3', t: 'Cash out in time', d: 'Hit cash out before the crash and the multiplier is yours.' },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#e50539] font-black">
                  {s.n}
                </span>
                <h3 className="mt-3 font-bold text-lg">{s.t}</h3>
                <p className="mt-1 text-gray-400 text-sm">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why this one — the honest differentiators ──────────────────── */}
      <section className="px-4 pb-14">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center text-2xl sm:text-3xl font-black mb-2">Why players trust it</h2>
          <p className="text-center text-gray-500 text-sm mb-8">
            Every claim below you can check yourself, in the game.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                i: '🛡️',
                t: 'Provably fair — verify it yourself',
                d: 'Before each round we publish the SHA-256 hash of the seed. After the crash we reveal the seed. Your own browser recomputes it. We cannot change a round once it has started.',
              },
              {
                i: '⚡',
                t: 'Deposits credited automatically',
                d: 'Send crypto to your in-app address. The moment the network confirms it, your balance updates — no ticket, no waiting on support.',
              },
              {
                i: '₿',
                t: 'Six networks, no bank',
                d: 'Bitcoin, Solana, Toncoin, BNB, Litecoin and Monero. Withdraw to any of them — you choose the chain.',
              },
              {
                i: '📊',
                t: 'House edge stated openly',
                d: 'A flat 5%, written into the published formula. No hidden adjustment, no per-player tuning.',
              },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <span className="text-2xl">{f.i}</span>
                <h3 className="mt-2 font-bold">{f.t}</h3>
                <p className="mt-1.5 text-gray-400 text-sm leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Install pitch, with a human face to lift engagement ────────── */}
      <section className="px-4 pb-14">
        <div className="max-w-3xl mx-auto rounded-3xl border border-white/10 bg-gradient-to-br from-[#e50539]/10 via-transparent to-transparent overflow-hidden">
          <div className="grid sm:grid-cols-[auto_1fr] items-end gap-6 p-6 sm:p-8">
            <Image
              src="/lp-player.jpeg"
              alt="A player reacting to a win"
              width={388}
              height={640}
              loading="lazy"
              className="rounded-2xl w-40 sm:w-52 h-auto justify-self-center ring-1 ring-white/10"
            />
            <div className="pb-2">
              <h2 className="text-2xl sm:text-3xl font-black leading-tight">
                Put it on your home screen.
              </h2>
              <p className="mt-3 text-gray-400">
                Install it like an app — full screen, no browser bar, one tap to play. No app store,
                no APK, nothing to update. It takes about five seconds.
              </p>
              <button
                onClick={handleInstall}
                className="mt-5 px-6 py-3 rounded-xl font-bold text-white bg-white/10 hover:bg-white/15 border border-white/15 transition active:scale-95"
              >
                📲 Install now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ — the objections that block a first deposit ────────────── */}
      <section className="px-4 pb-14">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-center text-2xl sm:text-3xl font-black mb-8">Before you deposit</h2>
          <div className="space-y-3">
            {[
              {
                q: 'How do I know the game is not rigged?',
                a: 'The crash point is locked in before the round starts and published as a hash. After the crash we reveal the seed so you can recompute the result in your browser. If a result did not match, anyone could prove it. Open the Provably Fair panel in the game to check any past round.',
              },
              {
                q: 'How fast can I withdraw?',
                a: 'Withdrawal requests go through a manual review, then we send the crypto to the address you provided on the network you picked. You will see the transaction hash once it is sent.',
              },
              {
                q: 'What is the catch with the bonus?',
                a: 'One wagering pass. Deposit 50 USDT, receive 50 USDT, wager 50 USDT total, and the balance is withdrawable. That is the whole condition.',
              },
              {
                q: 'Do I need to install anything?',
                a: 'No. It runs in your browser. If you want it full-screen with its own icon, you can install it as an app in one tap — no app store, no APK.',
              },
              {
                q: 'Is there a minimum deposit?',
                a: 'Yes, and it depends on the crypto you choose — each network has its own minimum, shown to you before you send anything.',
              },
            ].map((f) => (
              <details key={f.q} className="group rounded-2xl bg-white/5 border border-white/10 p-4">
                <summary className="cursor-pointer font-bold list-none flex items-center justify-between gap-3">
                  {f.q}
                  <span className="text-gray-500 transition-transform group-open:rotate-180">▼</span>
                </summary>
                <p className="mt-2.5 text-gray-400 text-sm leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="px-4 pb-16">
        <div className="max-w-xl mx-auto text-center rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-8">
          <h2 className="text-3xl font-black">Ready for take-off?</h2>
          <p className="mt-2 text-gray-400">A new round starts every few seconds.</p>
          <Link
            href={PLAY_URL}
            onClick={() => trackPlay('Final')}
            className="mt-6 block w-full py-4 rounded-2xl font-black text-lg text-white bg-gradient-to-b from-[#5bbf1c] to-[#28a909] hover:from-[#69d122] hover:to-[#2fbf0c] shadow-lg shadow-green-900/40 transition active:scale-95"
          >
            Play now
          </Link>
          <button
            onClick={handleInstall}
            className="mt-3 w-full py-3 rounded-2xl font-bold text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition"
          >
            📲 Install the app instead
          </button>
        </div>
      </section>

      {/* ── Responsible-gambling footer (legally required, not decoration) ─ */}
      <footer className="px-4 py-8 border-t border-white/10 text-center space-y-3">
        <p className="text-amber-500 font-black text-lg">18+</p>
        <p className="text-gray-500 text-xs max-w-xl mx-auto leading-relaxed">
          Gambling involves real financial risk and can be addictive. Never bet money you cannot
          afford to lose. This is a game of chance — there is no strategy that guarantees a win, and
          the house edge means the game is profitable for the operator over time.
        </p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500">
          <Link href="/terms" className="hover:text-gray-300">Terms</Link>
          <Link href="/privacy" className="hover:text-gray-300">Privacy</Link>
          <Link href="/responsible-gambling" className="hover:text-gray-300">Responsible gambling</Link>
        </div>
      </footer>

      {/* ── iOS install instructions (no beforeinstallprompt on Safari) ── */}
      {showIOSHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4"
          onClick={() => setShowIOSHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-gray-900 border border-white/15 p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg">Install on iPhone</h3>
            <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
              <li>Tap the <strong>Share</strong> button at the bottom of Safari</li>
              <li>Scroll and tap <strong>Add to Home Screen</strong></li>
              <li>Tap <strong>Add</strong> — the icon appears on your home screen</li>
            </ol>
            <button
              onClick={() => setShowIOSHelp(false)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 font-bold transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
