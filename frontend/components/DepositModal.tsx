/**
 * DepositModal.tsx
 * Deposit modal with real Stripe Elements for card payment.
 * Uses @stripe/react-stripe-js + @stripe/stripe-js.
 *
 * Flow:
 *  1. User enters amount → clicks "Continuer"
 *  2. Backend creates a PaymentIntent → returns clientSecret
 *  3. Stripe Elements renders the card form
 *  4. User confirms payment → Stripe processes it
 *  5. Backend webhook credits the balance automatically
 *  6. Frontend polls balance after confirmation to reflect the update
 */

'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useGameStore } from '@/store/gameStore';
import { createPaymentIntent, getBalance } from '@/lib/api';

// Load Stripe once (publishable key from env)
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

interface Props {
  onClose: () => void;
}

// ── Inner form rendered inside <Elements> ─────────────────────────────────────
const CheckoutForm = ({
  amount,
  userId,
  onSuccess,
}: {
  amount: number;
  userId: string;
  onSuccess: () => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const setBalance = useGameStore((s) => s.setBalance);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // No redirect — handle in-page
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message || 'Erreur de paiement');
      setLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Payment succeeded — poll balance a few times to catch webhook credit
      setSucceeded(true);
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const newBalance = await getBalance(userId);
          setBalance(newBalance);
        } catch (_) {}
        if (attempts >= 6) {
          clearInterval(poll);
          onSuccess();
        }
      }, 1500);
    } else {
      setError('Paiement non finalisé. Veuillez réessayer.');
      setLoading(false);
    }
  };

  if (succeeded) {
    return (
      <div className="text-center py-8 space-y-3">
        <div className="text-5xl">✅</div>
        <p className="text-green-400 font-bold text-lg">
          Paiement de {amount}€ confirmé !
        </p>
        <p className="text-gray-400 text-sm">
          Votre solde sera mis à jour dans quelques secondes…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Stripe Payment Element (card, Apple Pay, Google Pay, etc.) */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || loading}
        className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-40 transition active:scale-95"
      >
        {loading ? '⏳ Traitement...' : `💳 Payer ${amount}€`}
      </button>

      <p className="text-gray-600 text-xs text-center">
        Paiement sécurisé par Stripe. Vos données bancaires ne sont jamais stockées.
      </p>
    </form>
  );
};

// ── Main modal ────────────────────────────────────────────────────────────────
const DepositModal = ({ onClose }: Props) => {
  const { userId, setBalance } = useGameStore();
  const [amount, setAmount] = useState(20);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const presets = [10, 20, 50, 100, 200];

  // Step 1: create PaymentIntent when user confirms amount
  const handleContinue = async () => {
    if (!userId || amount < 1) return;
    setLoadingIntent(true);
    setError('');
    try {
      const secret = await createPaymentIntent(userId, amount);
      setClientSecret(secret);
    } catch (err: any) {
      setError(err.message || 'Impossible de créer le paiement');
    } finally {
      setLoadingIntent(false);
    }
  };

  const handleSuccess = async () => {
    setDone(true);
    // Final balance refresh
    if (userId) {
      try {
        const newBalance = await getBalance(userId);
        setBalance(newBalance);
      } catch (_) {}
    }
    setTimeout(onClose, 2000);
  };

  const stripeOptions = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: 'night' as const,
          variables: {
            colorPrimary: '#f97316',
            colorBackground: '#1f2937',
            colorText: '#ffffff',
            colorDanger: '#ef4444',
            borderRadius: '8px',
          },
        },
      }
    : null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-orange-900/40 rounded-2xl p-6 w-full max-w-sm space-y-5">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-white font-bold text-xl">💳 Déposer des fonds</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-5xl">✅</div>
            <p className="text-green-400 font-bold">Dépôt confirmé !</p>
            <p className="text-gray-400 text-sm">Fermeture automatique…</p>
          </div>
        ) : !clientSecret ? (
          /* ── Step 1: choose amount ── */
          <>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">
                Montant (€)
              </label>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-center text-xl font-bold focus:outline-none focus:border-orange-500"
              />
              <div className="flex gap-2 mt-2">
                {presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAmount(p)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-1.5 rounded-md transition"
                  >
                    {p}€
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              onClick={handleContinue}
              disabled={loadingIntent || amount < 1}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-40 transition active:scale-95"
            >
              {loadingIntent ? '⏳ Préparation...' : `Continuer → ${amount}€`}
            </button>

            <p className="text-gray-600 text-xs text-center">
              Paiement sécurisé par Stripe.
            </p>
          </>
        ) : (
          /* ── Step 2: Stripe Elements card form ── */
          <>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <button
                onClick={() => setClientSecret(null)}
                className="text-orange-400 hover:text-orange-300 text-xs underline"
              >
                ← Modifier le montant
              </button>
              <span className="ml-auto text-orange-400 font-bold">{amount}€</span>
            </div>

            {stripeOptions && (
              <Elements stripe={stripePromise} options={stripeOptions}>
                <CheckoutForm
                  amount={amount}
                  userId={userId!}
                  onSuccess={handleSuccess}
                />
              </Elements>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DepositModal;
