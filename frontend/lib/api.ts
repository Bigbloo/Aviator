/**
 * api.ts
 * API client for communicating with the Aviator backend.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface AuthResponse {
  userId: string;
  username: string;
  email: string;
  balance: number;
}

/**
 * Creates an account with username + email + password. If userId is provided
 * (existing anon session), credentials are attached to that account so the
 * balance is preserved.
 */
export const register = async (
  username: string,
  email: string,
  password: string,
  userId?: string | null
): Promise<AuthResponse> => {
  const res = await fetch(`${BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Échec de la création du compte');
  }
  return res.json();
};

/**
 * Logs in with email-or-username + password (bcrypt-verified server-side).
 */
export const login = async (
  identifier: string,
  password: string
): Promise<AuthResponse> => {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Connexion échouée');
  }
  return res.json();
};

/**
 * Creates a new user and returns userId.
 */
export const createUser = async (): Promise<{ userId: string; balance: number }> => {
  const res = await fetch(`${BASE_URL}/api/create`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create user');
  return res.json();
};

/**
 * Fetches the current balance + username for a user.
 */
export const getBalance = async (
  userId: string
): Promise<{ balance: number; username: string | null }> => {
  const res = await fetch(`${BASE_URL}/api/balance/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch balance');
  const data = await res.json();
  return { balance: data.balance, username: data.username ?? null };
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
  betAmount: number,
  slot: 1 | 2 = 1
): Promise<{ betId: string; slot: number; balance: number; status: string }> => {
  const res = await fetch(`${BASE_URL}/api/bet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roundId, betAmount, slot }),
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
  roundId: string,
  slot: 1 | 2 = 1
): Promise<{ result: 'won'; multiplier: number; payout: number; balance: number }> => {
  const res = await fetch(`${BASE_URL}/api/cashout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roundId, slot }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to cashout');
  }
  return res.json();
};

/**
 * Fetches the top-players leaderboard (by net profit). Demo-padded.
 */
export interface LeaderboardEntry {
  rank: number;
  name: string;
  net: number;
  rounds: number;
  real: boolean;
}
export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const res = await fetch(`${BASE_URL}/api/leaderboard`);
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  const data = await res.json();
  return data.leaderboard ?? [];
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
