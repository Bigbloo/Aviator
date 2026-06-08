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

// ── Crypto (USDT TRC-20) ─────────────────────────────────────────────────────

export interface CryptoCurrency {
  code: string;     // e.g. "usdttrc20"
  name: string;     // e.g. "USDT"
  network: string;  // e.g. "TRC-20 (Tron)"
}

/** Lists the pay-in currencies the player can deposit with. */
export const getCryptoCurrencies = async (): Promise<CryptoCurrency[]> => {
  const res = await fetch(`${BASE_URL}/api/crypto/currencies`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch currencies');
  const data = await res.json();
  return data.currencies ?? [];
};

export interface CryptoDeposit {
  depositId: string;
  address: string;
  amount: number;     // USDT value credited
  payAmount: number;  // amount to send, in the chosen crypto
  payCurrency: string;
  network: string;
  status: string;     // waiting | confirming | finished | failed
  mock?: boolean;
}

/** Creates a deposit in the chosen crypto and returns the pay-in address. */
export const createCryptoDeposit = async (
  amount: number,
  payCurrency: string
): Promise<CryptoDeposit> => {
  const res = await fetch(`${BASE_URL}/api/crypto/deposit`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ amount, payCurrency }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Échec de la création du dépôt');
  }
  return res.json();
};

/** Polls a deposit's status. */
export const getCryptoDeposit = async (
  depositId: string
): Promise<{ depositId: string; status: string; amount: number; received: number | null }> => {
  const res = await fetch(`${BASE_URL}/api/crypto/deposit/${depositId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch deposit');
  return res.json();
};

/** DEV ONLY: simulate the on-chain payment landing (404 in production). */
export const mockConfirmDeposit = async (
  depositId: string
): Promise<{ status: string; credited: boolean; balance: number }> => {
  const res = await fetch(`${BASE_URL}/api/crypto/_mock/confirm`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ depositId }),
  });
  if (!res.ok) throw new Error('mock confirm unavailable');
  return res.json();
};

export interface CryptoWithdrawal {
  withdrawalId: string;
  status: string; // processing | pending_review | completed | failed
  txid?: string;
  amount: number;
  address: string;
  balance: number;
  message: string;
}

/** Requests a USDT withdrawal to a TRC-20 address. */
export const createCryptoWithdrawal = async (
  amount: number,
  address: string
): Promise<CryptoWithdrawal> => {
  const res = await fetch(`${BASE_URL}/api/crypto/withdraw`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ amount, address }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Échec du retrait');
  }
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

// ── Admin: withdrawal review console ─────────────────────────────────────────

const adminHeaders = (token: string, extra: Record<string, string> = {}) => ({
  ...extra,
  'x-admin-token': token,
});

export interface AdminWithdrawal {
  id: string;
  amount: number;
  address: string;
  status: string; // pending_review | processing | completed | rejected | failed
  txid: string | null;
  payout_id: string | null;
  note: string | null;
  created_at: number;
  reviewed_at: number | null;
  user_id: string;
  username: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  user_address: string | null;
}

/** Verifies an admin token (200 if valid). */
export const adminPing = async (token: string): Promise<boolean> => {
  const res = await fetch(`${BASE_URL}/api/admin/ping`, { headers: adminHeaders(token) });
  return res.ok;
};

export const adminListWithdrawals = async (
  token: string,
  status = ''
): Promise<{ withdrawals: AdminWithdrawal[]; pendingCount: number }> => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${BASE_URL}/api/admin/withdrawals${q}`, { headers: adminHeaders(token) });
  if (!res.ok) throw new Error('Accès refusé');
  return res.json();
};

export const adminApproveWithdrawal = async (
  token: string,
  id: string,
  note = ''
): Promise<{ id: string; status: string; txid: string | null }> => {
  const res = await fetch(`${BASE_URL}/api/admin/withdrawals/${id}/approve`, {
    method: 'POST',
    headers: adminHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Échec de l'approbation");
  }
  return res.json();
};

export const adminRejectWithdrawal = async (
  token: string,
  id: string,
  note = ''
): Promise<{ id: string; status: string; refunded: number }> => {
  const res = await fetch(`${BASE_URL}/api/admin/withdrawals/${id}/reject`, {
    method: 'POST',
    headers: adminHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Échec du rejet');
  }
  return res.json();
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
