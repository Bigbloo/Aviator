/**
 * api.ts
 * API client for communicating with the Aviator backend.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Creates a new user and returns userId.
 */
export const createUser = async (): Promise<{ userId: string; balance: number }> => {
  const res = await fetch(`${BASE_URL}/api/create`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create user');
  return res.json();
};

/**
 * Fetches the current balance for a user.
 */
export const getBalance = async (userId: string): Promise<number> => {
  const res = await fetch(`${BASE_URL}/api/balance/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch balance');
  const data = await res.json();
  return data.balance;
};

/**
 * Creates a Stripe PaymentIntent and returns clientSecret.
 */
export const createPaymentIntent = async (
  userId: string,
  amount: number
): Promise<string> => {
  const res = await fetch(`${BASE_URL}/api/create-payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount }),
  });
  if (!res.ok) throw new Error('Failed to create payment intent');
  const data = await res.json();
  return data.clientSecret;
};

/**
 * DEV: Simulates a deposit without Stripe.
 */
export const simulateDeposit = async (
  userId: string,
  amount: number
): Promise<{ balance: number }> => {
  const res = await fetch(`${BASE_URL}/api/deposit/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount }),
  });
  if (!res.ok) throw new Error('Failed to simulate deposit');
  return res.json();
};

/**
 * Places a bet (debits balance, creates pending bet).
 */
export const placeBet = async (
  userId: string,
  roundId: string,
  betAmount: number
): Promise<{ betId: string; balance: number; status: string }> => {
  const res = await fetch(`${BASE_URL}/api/bet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roundId, betAmount }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to place bet');
  }
  return res.json();
};

/**
 * Cashes out — server uses its LIVE multiplier (anti-cheat).
 */
export const cashout = async (
  userId: string,
  roundId: string
): Promise<{ result: 'won'; multiplier: number; payout: number; balance: number }> => {
  const res = await fetch(`${BASE_URL}/api/cashout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roundId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to cashout');
  }
  return res.json();
};

/**
 * Requests a withdrawal.
 */
export const withdraw = async (
  userId: string,
  amount: number,
  stripeAccountId?: string
): Promise<{ success: boolean; message: string; balance: number }> => {
  const res = await fetch(`${BASE_URL}/api/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount, stripeAccountId }),
  });
  if (!res.ok) throw new Error('Failed to withdraw');
  return res.json();
};
