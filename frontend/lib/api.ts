/**
 * api.ts
 * API client for communicating with the Aviator backend.
 *
 * Auth model: the backend mints a JWT at create/register/login. We persist it
 * in localStorage and send it as `Authorization: Bearer` on every authed call.
 * The server derives the acting userId from that token — the client can no
 * longer act on an account just by knowing its userId.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'aviator_token';

export const getToken = (): string | null =>
  typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);

export const setToken = (token: string): void => {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = (): void => {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
};

/** Thrown when the server rejects our token (401) — caller should re-auth. */
export class AuthError extends Error {}

const authHeaders = (extra: Record<string, string> = {}): Record<string, string> => {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
};

export interface AuthResponse {
  userId: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  address: string | null;
  balance: number;
  token: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  address: string;
}

/**
 * Creates an account with username + email + password + identity. If a session
 * token is present (anon session), the backend attaches the credentials to that
 * account so the balance is preserved.
 */
export const register = async (input: RegisterInput): Promise<AuthResponse> => {
  const res = await fetch(`${BASE_URL}/api/register`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Échec de la création du compte');
  }
  const data: AuthResponse = await res.json();
  setToken(data.token);
  return data;
};

/**
 * Logs in with email-or-username + password (bcrypt-verified server-side).
 */
export const login = async (identifier: string, password: string): Promise<AuthResponse> => {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Connexion échouée');
  }
  const data: AuthResponse = await res.json();
  setToken(data.token);
  return data;
};

/**
 * Creates a new anonymous user and stores the returned session token.
 */
export const createUser = async (): Promise<{ userId: string; balance: number; token: string }> => {
  const res = await fetch(`${BASE_URL}/api/create`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create user');
  const data = await res.json();
  setToken(data.token);
  return data;
};

/**
 * Fetches the current balance + username for the authenticated user.
 * Throws AuthError on 401 so the caller can re-create an anon session.
 */
export const getBalance = async (): Promise<{ balance: number; username: string | null }> => {
  const res = await fetch(`${BASE_URL}/api/balance`, { headers: authHeaders() });
  if (res.status === 401) throw new AuthError('Session expired');
  if (!res.ok) throw new Error('Failed to fetch balance');
  const data = await res.json();
  return { balance: data.balance, username: data.username ?? null };
};

/**
 * Creates a Stripe PaymentIntent and returns clientSecret.
 */
export const createPaymentIntent = async (amount: number): Promise<string> => {
  const res = await fetch(`${BASE_URL}/api/create-payment-intent`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) throw new Error('Failed to create payment intent');
  const data = await res.json();
  return data.clientSecret;
};

/**
 * DEV: Simulates a deposit without Stripe (blocked server-side in production).
 */
export const simulateDeposit = async (amount: number): Promise<{ balance: number }> => {
  const res = await fetch(`${BASE_URL}/api/deposit/simulate`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) throw new Error('Failed to simulate deposit');
  return res.json();
};

/**
 * Places a bet (debits balance, creates pending bet).
 */
export const placeBet = async (
  roundId: string,
  betAmount: number,
  slot: 1 | 2 = 1
): Promise<{ betId: string; slot: number; balance: number; status: string }> => {
  const res = await fetch(`${BASE_URL}/api/bet`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ roundId, betAmount, slot }),
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
  roundId: string,
  slot: 1 | 2 = 1
): Promise<{ result: 'won'; multiplier: number; payout: number; balance: number }> => {
  const res = await fetch(`${BASE_URL}/api/cashout`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ roundId, slot }),
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
  amount: number,
  stripeAccountId?: string
): Promise<{ success: boolean; message: string; balance: number }> => {
  const res = await fetch(`${BASE_URL}/api/withdraw`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ amount, stripeAccountId }),
  });
  if (!res.ok) throw new Error('Failed to withdraw');
  return res.json();
};
