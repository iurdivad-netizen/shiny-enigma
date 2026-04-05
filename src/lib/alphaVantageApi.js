/**
 * Alpha Vantage API integration for historical market data.
 *
 * Provides historical daily stock prices and historical options data
 * for backtesting and analysis. Free tier: 25 requests/day.
 *
 * Get a free API key: https://www.alphavantage.co/support/#api-key
 */

const BASE_URL = 'https://www.alphavantage.co/query';

/* ── API Key management (localStorage) ────────────────────── */

const AV_KEY = 'alpha_vantage_api_key';

export function getStoredAvKey() {
  try {
    return localStorage.getItem(AV_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredAvKey(key) {
  try {
    localStorage.setItem(AV_KEY, key);
  } catch {
    // localStorage unavailable
  }
}

export function clearStoredAvKey() {
  try {
    localStorage.removeItem(AV_KEY);
  } catch {}
}

/* ── API calls ───────────────────────────────────────────── */

/**
 * Fetch daily historical prices for a symbol.
 * Returns array of { date, open, high, low, close, volume }.
 *
 * @param {string} symbol - Ticker symbol (e.g. "AAPL")
 * @param {string} apiKey - Alpha Vantage API key
 * @param {string} outputSize - "compact" (100 days) or "full" (20+ years)
 */
export async function fetchDailyHistory(symbol, apiKey, outputSize = 'compact') {
  const url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(
    symbol.toUpperCase()
  )}&outputsize=${outputSize}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Historical fetch failed: ${res.status}`);

  const data = await res.json();

  if (data['Error Message']) {
    throw new Error(`Symbol not found: ${symbol}`);
  }
  if (data['Note'] || data['Information']) {
    throw new Error('API rate limit reached (25/day). Please try again later.');
  }

  const timeSeries = data['Time Series (Daily)'];
  if (!timeSeries) throw new Error('No historical data returned');

  return Object.entries(timeSeries)
    .map(([date, values]) => ({
      date,
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume'], 10),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Fetch historical options chain for a symbol on a specific date.
 * Returns array of option contracts with Greeks.
 *
 * @param {string} symbol - Ticker symbol
 * @param {string} apiKey - Alpha Vantage API key
 * @param {string} [date] - Optional specific date (YYYY-MM-DD)
 */
export async function fetchHistoricalOptions(symbol, apiKey, date) {
  let url = `${BASE_URL}?function=HISTORICAL_OPTIONS&symbol=${encodeURIComponent(
    symbol.toUpperCase()
  )}&apikey=${apiKey}`;

  if (date) {
    url += `&date=${date}`;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Options history fetch failed: ${res.status}`);

  const data = await res.json();

  if (data['Error Message']) {
    throw new Error(data['Error Message']);
  }
  if (data['Note'] || data['Information']) {
    throw new Error('API rate limit reached (25/day). Please try again later.');
  }

  const options = data['data'];
  if (!options || !Array.isArray(options) || options.length === 0) {
    throw new Error('No historical options data returned');
  }

  return options.map((opt) => ({
    contractID: opt.contractID,
    symbol: opt.symbol,
    expiration: opt.expiration,
    strike: parseFloat(opt.strike),
    type: opt.type, // 'call' or 'put'
    last: parseFloat(opt.last) || 0,
    bid: parseFloat(opt.bid) || 0,
    ask: parseFloat(opt.ask) || 0,
    volume: parseInt(opt.volume, 10) || 0,
    open_interest: parseInt(opt.open_interest, 10) || 0,
    implied_volatility: parseFloat(opt.implied_volatility) || 0,
    delta: parseFloat(opt.delta) || 0,
    gamma: parseFloat(opt.gamma) || 0,
    theta: parseFloat(opt.theta) || 0,
    vega: parseFloat(opt.vega) || 0,
  }));
}

/**
 * Parse historical options data grouped by strike for UI display.
 * Same structure as tradierApi.parseChainByStrike for consistency.
 */
export function parseHistoricalChainByStrike(optionsData, spotPrice) {
  const byStrike = {};

  for (const opt of optionsData) {
    const k = opt.strike;
    if (!byStrike[k]) {
      byStrike[k] = { strike: k, call: null, put: null };
    }
    // Normalize to match Tradier-style shape for UI compatibility
    const normalized = {
      ...opt,
      option_type: opt.type,
      greeks: {
        delta: opt.delta,
        gamma: opt.gamma,
        theta: opt.theta,
        vega: opt.vega,
        mid_iv: opt.implied_volatility,
      },
    };
    if (opt.type === 'call') {
      byStrike[k].call = normalized;
    } else {
      byStrike[k].put = normalized;
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
