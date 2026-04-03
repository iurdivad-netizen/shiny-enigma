/**
 * Tradier Sandbox API integration.
 *
 * The sandbox provides 15-min delayed data with full Greeks (via ORATS),
 * CORS headers for browser-direct calls, and non-expiring API tokens.
 *
 * Get a free sandbox token: https://developer.tradier.com/
 */

const SANDBOX_BASE = 'https://sandbox.tradier.com/v1';

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

/* ── Token management (localStorage) ────────────────────── */

const TOKEN_KEY = 'tradier_sandbox_token';

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage unavailable (private browsing, etc.)
  }
}

export function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

/* ── API calls ───────────────────────────────────────────── */

/** Fetch a quote for a symbol. Returns { last, bid, ask, change, change_percentage, volume, description } */
export async function fetchQuote(symbol, token) {
  const res = await fetch(
    `${SANDBOX_BASE}/markets/quotes?symbols=${encodeURIComponent(symbol.toUpperCase())}`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`Quote fetch failed: ${res.status}`);
  const data = await res.json();
  const quote = data.quotes?.quote;
  if (!quote || quote.type === 'N/A') throw new Error(`Symbol not found: ${symbol}`);
  return quote;
}

/** Fetch available expiration dates for a symbol. Returns string[] of dates. */
export async function fetchExpirations(symbol, token) {
  const res = await fetch(
    `${SANDBOX_BASE}/markets/options/expirations?symbol=${encodeURIComponent(symbol.toUpperCase())}`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`Expirations fetch failed: ${res.status}`);
  const data = await res.json();
  const dates = data.expirations?.date;
  if (!dates) return [];
  return Array.isArray(dates) ? dates : [dates];
}

/**
 * Fetch full options chain for a symbol + expiration.
 * Returns array of option objects with Greeks.
 *
 * Each option: {
 *   symbol, description, strike, option_type ('call'|'put'),
 *   last, bid, ask, open_interest, volume,
 *   greeks: { delta, gamma, theta, vega, mid_iv, ... }
 * }
 */
export async function fetchChain(symbol, expiration, token) {
  const res = await fetch(
    `${SANDBOX_BASE}/markets/options/chains?symbol=${encodeURIComponent(
      symbol.toUpperCase()
    )}&expiration=${expiration}&greeks=true`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`Chain fetch failed: ${res.status}`);
  const data = await res.json();
  const options = data.options?.option;
  if (!options) return [];
  return Array.isArray(options) ? options : [options];
}

/**
 * Parse chain data into a structured format for the UI.
 * Groups by strike, with calls and puts side by side.
 */
export function parseChainByStrike(chainData, spotPrice) {
  const byStrike = {};

  for (const opt of chainData) {
    const k = opt.strike;
    if (!byStrike[k]) {
      byStrike[k] = { strike: k, call: null, put: null };
    }
    if (opt.option_type === 'call') {
      byStrike[k].call = opt;
    } else {
      byStrike[k].put = opt;
    }
  }

  return Object.values(byStrike)
    .sort((a, b) => a.strike - b.strike)
    .map((row) => ({
      ...row,
      callItm: row.strike < spotPrice,
      putItm: row.strike > spotPrice,
      atm: Math.abs(row.strike - spotPrice) / spotPrice < 0.005,
    }));
}
