/**
 * ProvablyFairModal.tsx
 * Commit-reveal verification UI. Shows the current round's committed hash and
 * the recent revealed rounds, each re-verified IN THE BROWSER with Web Crypto:
 *   1. SHA256(serverSeed) must equal the hash committed before the round.
 *   2. The crash point must equal the one derived from the seed.
 */

'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getFairRounds, type FairRound } from '@/lib/api';

interface Props {
  onClose: () => void;
}

const HOUSE_EDGE = 0.05;
const CRASH_SALT = ':aviator';

const sha256Hex = async (s: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Mirror of the server derivation (src/fair.js) — must stay in sync.
const crashFromSeed = async (serverSeed: string): Promise<number> => {
  const h = await sha256Hex(serverSeed + CRASH_SALT);
  const r = parseInt(h.slice(0, 13), 16) / Math.pow(2, 52);
  if (r < HOUSE_EDGE) return 1.0;
  return Math.round(Math.max(1.0, 0.99 / (1 - r)) * 100) / 100;
};

type VerifiedRound = FairRound & { hashOk: boolean; crashOk: boolean };

const ProvablyFairModal = ({ onClose }: Props) => {
  const { fairHash } = useGameStore();
  const [rounds, setRounds] = useState<VerifiedRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getFairRounds();
        const verified = await Promise.all(
          list.map(async (r) => ({
            ...r,
            hashOk: (await sha256Hex(r.serverSeed)) === r.seedHash,
            crashOk: (await crashFromSeed(r.serverSeed)) === r.crashPoint,
          }))
        );
        if (!cancelled) setRounds(verified);
      } catch {
        /* leave empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-orange-900/40 rounded-2xl p-6 w-full max-w-lg space-y-4 my-8">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-bold text-xl">🛡️ Provably Fair</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        <div className="text-gray-400 text-sm space-y-1.5">
          <p>
            Every round is <span className="text-white font-semibold">provably fair</span>:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-gray-500">
            <li>Before take-off, the server publishes the round&apos;s <span className="font-mono text-gray-400">SHA256(seed)</span> hash.</li>
            <li>The crash point is derived solely from that seed — it can no longer change.</li>
            <li>After the crash, the seed is revealed: you can recompute the hash and the crash yourself.</li>
          </ol>
          <p className="text-xs text-gray-600">
            The ✓ checks below are recomputed by <span className="text-gray-400">your browser</span>, not by the server.
          </p>
        </div>

        {/* Current round commit */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-gray-500 text-xs mb-1">Current round hash (commitment)</p>
          <p className="text-orange-300 text-xs font-mono break-all">{fairHash || '— waiting for the next round —'}</p>
        </div>

        {/* Verified history */}
        <div>
          <p className="text-gray-400 text-sm mb-2">Latest verified rounds</p>
          {loading ? (
            <p className="text-gray-600 text-sm text-center py-4">Loading…</p>
          ) : rounds.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-4">No revealed round yet.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {rounds.map((r) => {
                const ok = r.hashOk && r.crashOk;
                const open = expanded === r.roundId;
                return (
                  <div key={r.roundId} className="bg-gray-800 border border-gray-700 rounded-lg">
                    <button
                      onClick={() => setExpanded(open ? null : r.roundId)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left"
                    >
                      <span className={ok ? 'text-green-400' : 'text-red-400'}>{ok ? '✓' : '✗'}</span>
                      <span className={`font-bold text-sm ${r.crashPoint >= 2 ? 'text-green-400' : 'text-gray-300'}`}>
                        x{r.crashPoint.toFixed(2)}
                      </span>
                      <span className="text-gray-600 text-xs font-mono truncate flex-1">{r.seedHash.slice(0, 18)}…</span>
                      <span className="text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
                    </button>
                    {open && (
                      <div className="px-3 pb-3 space-y-1.5 text-xs">
                        <div>
                          <p className="text-gray-500">Hash published before the round</p>
                          <p className="font-mono text-gray-300 break-all">{r.seedHash}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Seed revealed after the crash</p>
                          <p className="font-mono text-gray-300 break-all">{r.serverSeed}</p>
                        </div>
                        <p className={r.hashOk ? 'text-green-400' : 'text-red-400'}>
                          {r.hashOk ? '✓ SHA256(seed) = published hash' : '✗ Hash does not match'}
                        </p>
                        <p className={r.crashOk ? 'text-green-400' : 'text-red-400'}>
                          {r.crashOk ? `✓ Recomputed crash = x${r.crashPoint.toFixed(2)}` : '✗ Crash does not match the seed'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-gray-600 text-[11px] leading-snug">
          Formula: r = first 13 hex of SHA256(seed + «&nbsp;{CRASH_SALT}&nbsp;») ÷ 2⁵²&nbsp;;
          crash = 1.00 if r &lt; 0.05, otherwise 0.99 ÷ (1 − r). House edge: 5%.
        </p>
      </div>
    </div>
  );
};

export default ProvablyFairModal;
