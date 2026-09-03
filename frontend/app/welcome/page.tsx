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

/**
 * Scrolling top banner. Every line is a factual product claim, so the banner
 * doubles as the offer summary for visitors who never scroll.
 */
const MARQUEE_ITEMS = [
  '🎁 Deposit 50 → get 50 USDT',
  '✓ Only 1× wagering',
  '🛡️ Provably fair — verify every round yourself',
  '⚡ Deposits credited automatically',
  '₿ Bitcoin · Solana · TON · BNB · Litecoin · Monero',
  '📲 Install in one tap — no app store',
  '🔒 Withdraw on the chain you choose',
];

function PromoMarquee() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-[#e50539] via-[#a3042a] to-[#e50539]">
      {/* Two identical copies: the track slides exactly one copy (-50%) and loops seamlessly. */}
      <div className="flex w-max animate-[marquee_40s_linear_infinite] motion-reduce:animate-none">
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
            {MARQUEE_ITEMS.map((t) => (
              <li
                key={t}
                className="flex items-center gap-4 whitespace-nowrap px-4 py-1.5 text-[11px] sm:text-xs font-bold text-white/95"
              >
                {t}
                <span aria-hidden className="text-white/35">✦</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#0e0e10]/60 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#0e0e10]/60 to-transparent"
      />
    </div>
  );
}

// Blends an isolated 3D render into the page background instead of showing its
// own rectangular backdrop.
const FADE_MASK = 'radial-gradient(circle at 50% 50%, #000 52%, transparent 76%)';

// Networks actually enabled on the payment account — mirrors backend POPULAR.
const CHAINS = [
  { name: 'Bitcoin', net: 'BTC', symbol: '₿', color: '#F7931A' },
  { name: 'Solana', net: 'SOL', symbol: '◎', color: '#9945FF' },
  { name: 'Toncoin', net: 'TON', symbol: '◈', color: '#0098EA' },
  { name: 'BNB', net: 'BEP-20', symbol: '◆', color: '#F3BA2F' },
  { name: 'Litecoin', net: 'LTC', symbol: 'Ł', color: '#345D9D' },
  { name: 'Monero', net: 'XMR', symbol: 'ɱ', color: '#FF6600' },
];

export default function WelcomePage() {
  const [rounds, setRounds] = useState<FairRound[]>([]);
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);

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

  // Mobile sticky CTA — held back until the hero button has scrolled away, so
  // it never competes with the primary call to action.
  useEffect(() => {
    const onScroll = () => setShowStickyCta(window.scrollY > 640);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
      {/* ── Sticky top bar: scrolling offer banner + header ────────────── */}
      <div className="sticky top-0 z-40">
        <PromoMarquee />
        <header className="flex items-center justify-between px-4 py-3 bg-[#0e0e10]/90 backdrop-blur border-b border-white/5">
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
      </div>

      {/* ── Side rails: artwork + a repeat of the offer CTA ──────────────
          Only from xl up: below 1280px the centred column leaves no margin to
          put them in, so they are hidden rather than squeezed over the copy.
          Fixed, so they stay in view all the way to the bottom of the page.
          The <aside> box itself is click-through; only the CTA takes clicks. */}
      {(['left', 'right'] as const).map((side) => (
        <aside
          key={side}
          aria-label="Welcome offer"
          className={`hidden xl:flex pointer-events-none fixed top-0 bottom-0 z-20 w-44 2xl:w-52 flex-col items-center justify-center gap-3 overflow-hidden px-2 ${
            side === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          {/* Dropped on short viewports so the CTA is never pushed off screen. */}
          <div className="relative hidden w-full [@media(min-height:660px)]:block">
            <Image
              src="/lp-rail.jpeg"
              alt=""
              aria-hidden
              width={400}
              height={713}
              loading="lazy"
              sizes="13rem"
              className="w-full h-auto rounded-2xl ring-1 ring-white/10 shadow-2xl shadow-black/70"
            />
            {/* Fades toward the middle of the page: the artwork is far more
                saturated than the page, and would pull the eye off the copy. */}
            <div
              aria-hidden
              className={`absolute inset-0 rounded-2xl ${
                side === 'left'
                  ? 'bg-gradient-to-r from-transparent via-[#0e0e10]/20 to-[#0e0e10]/80'
                  : 'bg-gradient-to-l from-transparent via-[#0e0e10]/20 to-[#0e0e10]/80'
              }`}
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/3 rounded-b-2xl bg-gradient-to-t from-[#0e0e10] to-transparent"
            />
          </div>

          <Link
            href={PLAY_URL}
            onClick={() => trackPlay(side === 'left' ? 'RailLeft' : 'RailRight')}
            className="group pointer-events-auto w-full rounded-2xl border border-white/15 bg-[#0e0e10]/85 backdrop-blur px-3 py-4 text-center shadow-2xl shadow-black/70 transition hover:border-[#e50539]/60"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Welcome offer
            </p>
            <p className="mt-1.5 text-2xl font-black leading-none">
              50 <span className="text-amber-400">+</span> 50
            </p>
            <p className="mt-1 text-[11px] text-gray-400">USDT · only 1× wagering</p>
            <span className="mt-3 block rounded-full bg-gradient-to-b from-[#5bbf1c] to-[#28a909] py-2 text-sm font-black transition group-active:scale-95">
              Play now
            </span>
            <p className="mt-2 text-[10px] text-gray-600">18+</p>
          </Link>
        </aside>
      ))}

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
              {
                n: '1',
                img: '/lp-step-bet.jpeg',
                alt: 'A stack of glowing casino chips beside a green button light',
                t: 'Place your bet',
                d: 'Pick your stake before take-off. You can run two bets at once.',
              },
              {
                n: '2',
                img: '/lp-step-climb.jpeg',
                alt: 'A red glowing curve arcing upward with a small plane at its tip',
                t: 'Watch it climb',
                d: 'The multiplier rises every second the plane stays in the air.',
              },
              {
                n: '3',
                img: '/lp-step-cash.jpeg',
                alt: 'Golden coins cascading into an open wallet',
                t: 'Cash out in time',
                d: 'Hit cash out before the crash and the multiplier is yours.',
              },
            ].map((s) => (
              <div
                key={s.n}
                className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
              >
                <div className="relative">
                  <Image
                    src={s.img}
                    alt={s.alt}
                    width={440}
                    height={440}
                    loading="lazy"
                    sizes="(min-width: 640px) 20rem, 100vw"
                    className="w-full h-36 sm:h-40 object-cover"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-[#141416] to-transparent"
                  />
                  <span className="absolute bottom-3 left-4 inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#e50539] font-black shadow-lg shadow-black/50">
                    {s.n}
                  </span>
                </div>
                <div className="p-5 pt-4">
                  <h3 className="font-bold text-lg">{s.t}</h3>
                  <p className="mt-1 text-gray-400 text-sm">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why this one — the honest differentiators ──────────────────── */}
      <section className="px-4 pb-14">
        <div className="max-w-3xl mx-auto">
          <Image
            src="/lp-trust.jpeg"
            alt="A glowing shield surrounded by data streams, representing cryptographic verification"
            width={600}
            height={600}
            loading="lazy"
            sizes="10rem"
            /* Radial mask: the render's own near-black backdrop is not exactly the
               page colour, so without this it reads as a visible grey rectangle. */
            style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
            className="mx-auto w-32 sm:w-40 h-auto mb-4"
          />
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

      {/* ── Payments band — the "can I actually get paid?" reassurance ─── */}
      <section className="px-4 pb-14">
        <div className="max-w-3xl mx-auto rounded-3xl border border-white/10 overflow-hidden bg-black/25">
          <div className="relative">
            <Image
              src="/lp-crypto.jpeg"
              alt="Six metallic coins hovering in a constellation, linked by faint light filaments"
              width={1200}
              height={686}
              loading="lazy"
              sizes="(min-width: 768px) 48rem, 100vw"
              /* Coins sit slightly above centre in the render — pulling the crop
                 up keeps them clear of the headline overlay. */
              className="w-full h-52 sm:h-64 object-cover object-[center_38%]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-[#0e0e10] via-[#0e0e10]/45 to-transparent"
            />
            <div className="absolute inset-x-0 bottom-0 px-5 sm:px-7 pb-4">
              <h2 className="text-2xl sm:text-3xl font-black leading-tight">
                Six chains. No bank involved.
              </h2>
            </div>
          </div>

          <div className="px-5 sm:px-7 pt-4 pb-6">
            <p className="text-gray-400 text-sm sm:text-base">
              Deposit from any of these networks and withdraw to the one you prefer — you pick the
              chain, we send to the address you give us. No card, no IBAN, no third-party wallet
              to connect.
            </p>

            <ul className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CHAINS.map((c) => (
                <li
                  key={c.net}
                  className="flex items-center gap-2.5 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5"
                >
                  <span
                    className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full text-base font-black"
                    style={{ background: `${c.color}22`, color: c.color }}
                    aria-hidden
                  >
                    {c.symbol}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold truncate">{c.name}</span>
                    <span className="block text-[11px] text-gray-500">{c.net}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Install pitch, with a human face to lift engagement ────────── */}
      <section className="px-4 pb-14">
        <div className="max-w-3xl mx-auto rounded-3xl border border-white/10 bg-gradient-to-br from-[#e50539]/10 via-transparent to-transparent overflow-hidden">
          <div className="grid sm:grid-cols-[auto_1fr] items-end gap-6 p-6 sm:p-8">
            <Image
              src="/lp-hand.jpeg"
              alt="The Aviator app open on a phone, the red multiplier curve climbing"
              width={800}
              height={800}
              loading="lazy"
              className="rounded-2xl w-40 sm:w-52 h-auto justify-self-center ring-1 ring-white/10 shadow-2xl shadow-black/50"
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
          <Image
            src="/lp-fair.jpeg"
            alt="A dark crystal lit from within, splitting open along a seam of red light"
            width={440}
            height={440}
            loading="lazy"
            sizes="9rem"
            style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
            className="mx-auto w-28 sm:w-36 h-auto"
          />
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
        <div className="relative max-w-xl mx-auto overflow-hidden rounded-3xl border border-white/10">
          <Image
            src="/lp-cta.jpeg"
            alt=""
            aria-hidden
            fill
            loading="lazy"
            sizes="(min-width: 640px) 36rem, 100vw"
            /* Frame the lit cloud layer rather than the empty dark sky above it,
               otherwise the crop reads as a black rectangle. */
            className="object-cover object-[center_62%]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-[#0e0e10] via-[#0e0e10]/75 to-[#0e0e10]/20"
          />
          <div className="relative p-8 text-center">
            <h2 className="text-3xl font-black drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
              Ready for take-off?
            </h2>
            <p className="mt-2 text-gray-300">A new round starts every few seconds.</p>
            <Link
              href={PLAY_URL}
              onClick={() => trackPlay('Final')}
              className="mt-6 block w-full py-4 rounded-2xl font-black text-lg text-white bg-gradient-to-b from-[#5bbf1c] to-[#28a909] hover:from-[#69d122] hover:to-[#2fbf0c] shadow-lg shadow-green-900/40 transition active:scale-95"
            >
              Play now
            </Link>
            <button
              onClick={handleInstall}
              className="mt-3 w-full py-3 rounded-2xl font-bold text-gray-200 bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur transition"
            >
              📲 Install the app instead
            </button>
          </div>
        </div>
      </section>

      {/* ── Responsible-gambling footer (legally required, not decoration) ─ */}
      <footer className="px-4 pt-8 pb-28 sm:pb-8 border-t border-white/10 text-center space-y-3">
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

      {/* ── Mobile sticky CTA — slides in once the hero button is gone ─── */}
      <div
        className={`sm:hidden fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ${
          showStickyCta ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex items-center gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#0e0e10]/95 backdrop-blur border-t border-white/10">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate">
              Deposit 50 <span className="text-amber-400">→</span> get 50 USDT
            </p>
            <p className="text-[10px] text-gray-500">1× wagering · 18+</p>
          </div>
          <Link
            href={PLAY_URL}
            onClick={() => trackPlay('StickyBar')}
            className="shrink-0 px-5 py-2.5 rounded-full font-black text-sm text-white bg-gradient-to-b from-[#5bbf1c] to-[#28a909] shadow-lg shadow-green-900/40 transition active:scale-95"
          >
            Play now
          </Link>
        </div>
      </div>

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
