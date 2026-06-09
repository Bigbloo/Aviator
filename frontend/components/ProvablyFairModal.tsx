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
            Chaque round est <span className="text-white font-semibold">prouvé équitable</span> :
          </p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-gray-500">
            <li>Avant le décollage, le serveur publie l&apos;empreinte <span className="font-mono text-gray-400">SHA256(seed)</span> du round.</li>
            <li>Le point de crash est calculé uniquement à partir de ce seed — il ne peut plus changer.</li>
            <li>Après le crash, le seed est révélé : tu peux recalculer l&apos;empreinte et le crash toi-même.</li>
          </ol>
          <p className="text-xs text-gray-600">
            Les coches ✓ ci-dessous sont recalculées par <span className="text-gray-400">ton navigateur</span>, pas par le serveur.
          </p>
        </div>

        {/* Current round commit */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-gray-500 text-xs mb-1">Empreinte du round en cours (engagement)</p>
          <p className="text-orange-300 text-xs font-mono break-all">{fairHash || '— en attente du prochain round —'}</p>
        </div>

        {/* Verified history */}
        <div>
          <p className="text-gray-400 text-sm mb-2">Derniers rounds vérifiés</p>
          {loading ? (
            <p className="text-gray-600 text-sm text-center py-4">Chargement…</p>
          ) : rounds.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-4">Aucun round révélé pour l&apos;instant.</p>
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
                          <p className="text-gray-500">Empreinte publiée avant le round</p>
                          <p className="font-mono text-gray-300 break-all">{r.seedHash}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Seed révélé après le crash</p>
                          <p className="font-mono text-gray-300 break-all">{r.serverSeed}</p>
                        </div>
                        <p className={r.hashOk ? 'text-green-400' : 'text-red-400'}>
                          {r.hashOk ? '✓ SHA256(seed) = empreinte publiée' : '✗ L’empreinte ne correspond pas'}
                        </p>
                        <p className={r.crashOk ? 'text-green-400' : 'text-red-400'}>
                          {r.crashOk ? `✓ Crash recalculé = x${r.crashPoint.toFixed(2)}` : '✗ Le crash ne correspond pas au seed'}
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
          Formule : r = 13 premiers hex de SHA256(seed + «&nbsp;{CRASH_SALT}&nbsp;») ÷ 2⁵²&nbsp;;
          crash = 1.00 si r &lt; 0.05, sinon 0.99 ÷ (1 − r). Avantage maison : 5%.
        </p>
      </div>
    </div>
  );
};

export default ProvablyFairModal;
