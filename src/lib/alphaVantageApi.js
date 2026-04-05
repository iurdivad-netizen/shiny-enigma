/**
 * Alpha Vantage API integration for historical market data.
 *
 * Provides historical stock prices (intraday / daily / weekly / monthly),
 * historical options data, and CSV/JSON export for backtesting.
 * Free tier: 25 requests/day.
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

/* ── Available endpoints catalog ──────────────────────────── */

/**
 * Full catalog of Alpha Vantage endpoints usable with this integration.
 * Displayed in the API Info panel so users know what's available.
 */
export const AV_ENDPOINTS = [
  {
    id: 'TIME_SERIES_INTRADAY',
    name: 'Intraday',
    description: 'OHLCV data at 1, 5, 15, 30, or 60-min intervals. Covers extended hours.',
    dataType: 'Stock Prices',
    tier: 'Free',
    params: ['symbol', 'interval (1min/5min/15min/30min/60min)', 'outputsize'],
    historyDepth: '20+ years (premium) / 1-2 months (free compact)',
  },
  {
    id: 'TIME_SERIES_DAILY',
    name: 'Daily',
    description: 'Daily OHLCV. Compact returns latest 100 data points; full returns 20+ years.',
    dataType: 'Stock Prices',
    tier: 'Free',
    params: ['symbol', 'outputsize (compact/full)'],
    historyDepth: '20+ years',
  },
  {
    id: 'TIME_SERIES_WEEKLY',
    name: 'Weekly',
    description: 'Weekly OHLCV aggregated to the last trading day of each week.',
    dataType: 'Stock Prices',
    tier: 'Free',
    params: ['symbol'],
    historyDepth: '20+ years',
  },
  {
    id: 'TIME_SERIES_MONTHLY',
    name: 'Monthly',
    description: 'Monthly OHLCV aggregated to the last trading day of each month.',
    dataType: 'Stock Prices',
    tier: 'Free',
    params: ['symbol'],
    historyDepth: '20+ years',
  },
  {
    id: 'GLOBAL_QUOTE',
    name: 'Quote',
    description: 'Lightweight latest price, change, change%, volume, and previous close.',
    dataType: 'Stock Prices',
    tier: 'Free',
    params: ['symbol'],
    historyDepth: 'Current only',
  },
  {
    id: 'SYMBOL_SEARCH',
    name: 'Ticker Search',
    description: 'Search for ticker symbols by name or keyword. Returns matches with region & type.',
    dataType: 'Reference',
    tier: 'Free',
    params: ['keywords'],
    historyDepth: 'N/A',
  },
  {
    id: 'HISTORICAL_OPTIONS',
    name: 'Historical Options',
    description: 'Full options chain for a past date: strike, bid/ask, IV, Greeks, OI.',
    dataType: 'Options',
    tier: 'Free',
    params: ['symbol', 'date (YYYY-MM-DD, optional)'],
    historyDepth: '2+ years',
  },
  {
    id: 'NEWS_SENTIMENT',
    name: 'News & Sentiment',
    description: 'Market news articles with AI-powered sentiment scores per ticker.',
    dataType: 'Sentiment',
    tier: 'Free',
    params: ['tickers', 'topics', 'time_from', 'time_to'],
    historyDepth: '~1 year',
  },
  {
    id: 'OVERVIEW',
    name: 'Company Overview',
    description: 'Fundamentals: market cap, P/E, EPS, dividend yield, 52-week range, sector.',
    dataType: 'Fundamentals',
    tier: 'Free',
    params: ['symbol'],
    historyDepth: 'Current snapshot',
  },
  {
    id: 'EARNINGS',
    name: 'Earnings',
    description: 'Quarterly and annual earnings: reported EPS, estimated EPS, surprise %.',
    dataType: 'Fundamentals',
    tier: 'Free',
    params: ['symbol'],
    historyDepth: '5+ years',
  },
  {
    id: 'RSI',
    name: 'RSI (Relative Strength Index)',
    description: 'Technical indicator: RSI at specified time period and interval.',
    dataType: 'Technical Indicator',
    tier: 'Free',
    params: ['symbol', 'interval', 'time_period', 'series_type'],
    historyDepth: '20+ years',
  },
  {
    id: 'MACD',
    name: 'MACD',
    description: 'Moving Average Convergence/Divergence signal line and histogram.',
    dataType: 'Technical Indicator',
    tier: 'Free',
    params: ['symbol', 'interval', 'series_type'],
    historyDepth: '20+ years',
  },
  {
    id: 'SMA',
    name: 'SMA (Simple Moving Average)',
    description: 'Simple moving average for any time period and interval.',
    dataType: 'Technical Indicator',
    tier: 'Free',
    params: ['symbol', 'interval', 'time_period', 'series_type'],
    historyDepth: '20+ years',
  },
  {
    id: 'EMA',
    name: 'EMA (Exponential Moving Average)',
    description: 'Exponential moving average for any time period and interval.',
    dataType: 'Technical Indicator',
    tier: 'Free',
    params: ['symbol', 'interval', 'time_period', 'series_type'],
    historyDepth: '20+ years',
  },
  {
    id: 'BBANDS',
    name: 'Bollinger Bands',
    description: 'Upper, middle, and lower Bollinger Bands.',
    dataType: 'Technical Indicator',
    tier: 'Free',
    params: ['symbol', 'interval', 'time_period', 'series_type'],
    historyDepth: '20+ years',
  },
  {
    id: 'REAL_GDP',
    name: 'Real GDP',
    description: 'US quarterly/annual real GDP data.',
    dataType: 'Economic',
    tier: 'Free',
    params: ['interval (quarterly/annual)'],
    historyDepth: '20+ years',
  },
  {
    id: 'FEDERAL_FUNDS_RATE',
    name: 'Federal Funds Rate',
    description: 'Current and historical federal funds (interest) rate.',
    dataType: 'Economic',
    tier: 'Free',
    params: ['interval (daily/weekly/monthly)'],
    historyDepth: '20+ years',
  },
  {
    id: 'CPI',
    name: 'CPI (Consumer Price Index)',
    description: 'Monthly and semiannual US consumer price index.',
    dataType: 'Economic',
    tier: 'Free',
    params: ['interval (monthly/semiannual)'],
    historyDepth: '20+ years',
  },
];

/** Group endpoints by dataType for display */
export function getEndpointsByCategory() {
  const cats = {};
  for (const ep of AV_ENDPOINTS) {
    if (!cats[ep.dataType]) cats[ep.dataType] = [];
    cats[ep.dataType].push(ep);
  }
  return cats;
}

/* ── Shared helpers ──────────────────────────────────────── */

function checkRateLimit(data) {
  if (data['Error Message']) {
    throw new Error(data['Error Message']);
  }
  if (data['Note'] || data['Information']) {
    throw new Error('API rate limit reached (25/day). Please try again later.');
  }
}

function parseOHLCV(timeSeries) {
  return Object.entries(timeSeries)
    .map(([date, v]) => ({
      date,
      open: parseFloat(v['1. open']),
      high: parseFloat(v['2. high']),
      low: parseFloat(v['3. low']),
      close: parseFloat(v['4. close']),
      volume: parseInt(v['5. volume'], 10),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ── Time Series API calls ───────────────────────────────── */

/**
 * Fetch intraday prices.
 * @param {string} symbol
 * @param {string} apiKey
 * @param {string} interval - '1min' | '5min' | '15min' | '30min' | '60min'
 * @param {string} outputSize - 'compact' | 'full'
 */
export async function fetchIntradayHistory(symbol, apiKey, interval = '5min', outputSize = 'compact') {
  const url = `${BASE_URL}?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(
    symbol.toUpperCase()
  )}&interval=${interval}&outputsize=${outputSize}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Intraday fetch failed: ${res.status}`);
  const data = await res.json();
  checkRateLimit(data);

  const key = `Time Series (${interval})`;
  const timeSeries = data[key];
  if (!timeSeries) throw new Error('No intraday data returned');
  return parseOHLCV(timeSeries);
}

/**
 * Fetch daily historical prices.
 * @param {string} symbol
 * @param {string} apiKey
 * @param {string} outputSize - 'compact' (100 days) | 'full' (20+ years)
 */
export async function fetchDailyHistory(symbol, apiKey, outputSize = 'compact') {
  const url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(
    symbol.toUpperCase()
  )}&outputsize=${outputSize}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Daily fetch failed: ${res.status}`);
  const data = await res.json();
  checkRateLimit(data);

  const timeSeries = data['Time Series (Daily)'];
  if (!timeSeries) throw new Error('No daily data returned');
  return parseOHLCV(timeSeries);
}

/**
 * Fetch weekly historical prices.
 * @param {string} symbol
 * @param {string} apiKey
 */
export async function fetchWeeklyHistory(symbol, apiKey) {
  const url = `${BASE_URL}?function=TIME_SERIES_WEEKLY&symbol=${encodeURIComponent(
    symbol.toUpperCase()
  )}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weekly fetch failed: ${res.status}`);
  const data = await res.json();
  checkRateLimit(data);

  const timeSeries = data['Weekly Time Series'];
  if (!timeSeries) throw new Error('No weekly data returned');
  return parseOHLCV(timeSeries);
}

/**
 * Fetch monthly historical prices.
 * @param {string} symbol
 * @param {string} apiKey
 */
export async function fetchMonthlyHistory(symbol, apiKey) {
  const url = `${BASE_URL}?function=TIME_SERIES_MONTHLY&symbol=${encodeURIComponent(
    symbol.toUpperCase()
  )}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Monthly fetch failed: ${res.status}`);
  const data = await res.json();
  checkRateLimit(data);

  const timeSeries = data['Monthly Time Series'];
  if (!timeSeries) throw new Error('No monthly data returned');
  return parseOHLCV(timeSeries);
}

/**
 * Fetch a lightweight real-time quote.
 * Returns { symbol, open, high, low, price, volume, latestDay, prevClose, change, changePct }.
 */
export async function fetchGlobalQuote(symbol, apiKey) {
  const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
    symbol.toUpperCase()
  )}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Quote fetch failed: ${res.status}`);
  const data = await res.json();
  checkRateLimit(data);

  const q = data['Global Quote'];
  if (!q || !q['01. symbol']) throw new Error(`Symbol not found: ${symbol}`);

  return {
    symbol: q['01. symbol'],
    open: parseFloat(q['02. open']),
    high: parseFloat(q['03. high']),
    low: parseFloat(q['04. low']),
    price: parseFloat(q['05. price']),
    volume: parseInt(q['06. volume'], 10),
    latestDay: q['07. latest trading day'],
    prevClose: parseFloat(q['08. previous close']),
    change: parseFloat(q['09. change']),
    changePct: parseFloat(q['10. change percent']),
  };
}

/**
 * Search for ticker symbols by keyword.
 * Returns array of { symbol, name, type, region, currency }.
 */
export async function searchTicker(keywords, apiKey) {
  const url = `${BASE_URL}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(
    keywords
  )}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  checkRateLimit(data);

  const matches = data['bestMatches'];
  if (!matches) return [];

  return matches.map((m) => ({
    symbol: m['1. symbol'],
    name: m['2. name'],
    type: m['3. type'],
    region: m['4. region'],
    currency: m['8. currency'],
  }));
}

/* ── Historical Options ──────────────────────────────────── */

/**
 * Fetch historical options chain for a symbol on a specific date.
 * Returns array of option contracts with Greeks.
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
  checkRateLimit(data);

  const options = data['data'];
  if (!options || !Array.isArray(options) || options.length === 0) {
    throw new Error('No historical options data returned');
  }

  return options.map((opt) => ({
    contractID: opt.contractID,
    symbol: opt.symbol,
    expiration: opt.expiration,
    strike: parseFloat(opt.strike),
    type: opt.type,
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
 */
export function parseHistoricalChainByStrike(optionsData, spotPrice) {
  const byStrike = {};

  for (const opt of optionsData) {
    const k = opt.strike;
    if (!byStrike[k]) {
      byStrike[k] = { strike: k, call: null, put: null };
    }
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

/* ── Data Export ──────────────────────────────────────────── */

/**
 * Convert OHLCV data array to CSV string.
 */
export function toCSV(data) {
  if (!data.length) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => row[h]).join(','));
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Trigger a browser file download.
 */
export function downloadFile(content, filename, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
