/**
 * Backtesting engine for options strategies.
 *
 * Runs a strategy against historical price data, generating trades
 * and portfolio snapshots at each time step.
 */

import { bsmPrice } from './blackScholes.js';
import {
  createPortfolio, createTrade, addTrade, closeTrade,
  expireTrade, takeSnapshot, calcMetrics,
} from './portfolio.js';

/* ── Strategy definitions for backtesting ───────────────── */

/**
 * Build legs for a strategy at a given spot price.
 * Returns array of { type, direction, strike, iv, quantity }.
 */
const BACKTEST_STRATEGIES = {
  'Long Call (ATM)': (S) => [
    { type: 'call', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
  ],
  'Long Put (ATM)': (S) => [
    { type: 'put', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
  ],
  'Bull Call Spread': (S) => [
    { type: 'call', direction: 'long', strike: Math.round(S * 0.97), iv: 0.30, quantity: 1 },
    { type: 'call', direction: 'short', strike: Math.round(S * 1.03), iv: 0.28, quantity: 1 },
  ],
  'Bear Put Spread': (S) => [
    { type: 'put', direction: 'long', strike: Math.round(S * 1.03), iv: 0.30, quantity: 1 },
    { type: 'put', direction: 'short', strike: Math.round(S * 0.97), iv: 0.28, quantity: 1 },
  ],
  'Iron Condor': (S) => [
    { type: 'put', direction: 'short', strike: Math.round(S * 0.95), iv: 0.28, quantity: 1 },
    { type: 'put', direction: 'long', strike: Math.round(S * 0.90), iv: 0.30, quantity: 1 },
    { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
    { type: 'call', direction: 'long', strike: Math.round(S * 1.10), iv: 0.30, quantity: 1 },
  ],
  'Straddle': (S) => [
    { type: 'call', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
    { type: 'put', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
  ],
  'Strangle': (S) => [
    { type: 'call', direction: 'long', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
    { type: 'put', direction: 'long', strike: Math.round(S * 0.95), iv: 0.28, quantity: 1 },
  ],
  'Covered Call': (S) => [
    { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
  ],
  'Protective Put': (S) => [
    { type: 'put', direction: 'long', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1 },
  ],
  'Butterfly Spread': (S) => [
    { type: 'call', direction: 'long', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1 },
    { type: 'call', direction: 'short', strike: Math.round(S), iv: 0.29, quantity: 2 },
    { type: 'call', direction: 'long', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
  ],
};

export const STRATEGY_NAMES = Object.keys(BACKTEST_STRATEGIES);

/**
 * Run a backtest.
 *
 * @param {Object} config
 * @param {string} config.strategy - One of STRATEGY_NAMES
 * @param {Array} config.priceData - Array of { date, open, high, low, close, volume }
 * @param {string} config.symbol
 * @param {number} [config.dte=30] - Days to expiry for each trade
 * @param {number} [config.entryInterval=30] - Days between new entries
 * @param {number} [config.iv=0.30] - Default implied volatility
 * @param {number} [config.riskFreeRate=0.05]
 * @param {number} [config.divYield=0]
 * @param {number} [config.startingCapital=10000]
 * @param {number} [config.commissionPerContract=0.65]
 * @param {number} [config.stopLossPct=0] - Stop loss as % of premium (0 = disabled)
 * @param {number} [config.takeProfitPct=0] - Take profit as % of premium (0 = disabled)
 * @returns {{ portfolio: Object, metrics: Object, equityCurve: Array }}
 */
export function runBacktest({
  strategy,
  priceData,
  symbol,
  dte = 30,
  entryInterval = 30,
  iv = 0.30,
  riskFreeRate = 0.05,
  divYield = 0,
  startingCapital = 10000,
  commissionPerContract = 0.65,
  stopLossPct = 0,
  takeProfitPct = 0,
}) {
  const strategyFn = BACKTEST_STRATEGIES[strategy];
  if (!strategyFn) throw new Error(`Unknown strategy: ${strategy}`);
  if (!priceData || priceData.length < 2) throw new Error('Insufficient price data');

  let portfolio = createPortfolio({ name: `Backtest: ${strategy}`, mode: 'backtest', symbol });
  portfolio.config.startingCapital = startingCapital;
  portfolio.config.commissionPerContract = commissionPerContract;

  let daysSinceEntry = entryInterval; // Enter on first day

  for (let i = 0; i < priceData.length; i++) {
    const bar = priceData[i];
    const spot = bar.close;
    const date = bar.date;

    // Check for expirations and stop/take-profit on open trades
    portfolio = processOpenTrades(portfolio, spot, date, riskFreeRate, divYield, stopLossPct, takeProfitPct);

    // Enter new position?
    daysSinceEntry++;
    if (daysSinceEntry >= entryInterval) {
      const legs = strategyFn(spot);
      const expDate = addDays(date, dte);

      for (const leg of legs) {
        const legIv = leg.iv || iv;
        const t = dte / 365;
        const prices = bsmPrice(spot, leg.strike, t, riskFreeRate, legIv, divYield);
        const premium = leg.type === 'call' ? prices.call : prices.put;

        const trade = createTrade({
          symbol,
          type: leg.type,
          direction: leg.direction,
          strike: leg.strike,
          premium: Math.round(premium * 100) / 100,
          quantity: leg.quantity,
          iv: legIv,
          underlyingPrice: spot,
          expiration: expDate,
        });
        trade._commission = commissionPerContract;
        portfolio = addTrade(portfolio, trade);
      }
      daysSinceEntry = 0;
    }

    // Take daily snapshot
    portfolio = takeSnapshot(portfolio, spot, date, riskFreeRate, divYield);
  }

  // Close any remaining open trades at last price
  const lastBar = priceData[priceData.length - 1];
  for (const trade of portfolio.trades) {
    if (trade.status === 'open') {
      portfolio = expireTrade(portfolio, trade.id, lastBar.close);
    }
  }

  const metrics = calcMetrics(portfolio);
  return { portfolio, metrics, equityCurve: portfolio.snapshots };
}

/**
 * Run a manual backtest — enter a specific trade at a specific date,
 * then simulate forward through price data to see the outcome.
 *
 * @param {Object} config
 * @param {Array} config.legs - Array of { type, direction, strike, iv, quantity, premium?, dte? }
 * @param {Array} config.priceData - Array of { date, close, ... } (full history)
 * @param {string} config.symbol
 * @param {string} config.entryDate - ISO date string to enter the trade
 * @param {string} [config.exitDate] - ISO date string to exit (or hold to expiry)
 * @param {number} [config.dte=30] - Days to expiry from entry date
 * @param {number} [config.riskFreeRate=0.05]
 * @param {number} [config.divYield=0]
 * @param {number} [config.startingCapital=10000]
 * @param {number} [config.commissionPerContract=0.65]
 * @param {string} [config.portfolioName]
 * @returns {{ portfolio: Object, metrics: Object, equityCurve: Array }}
 */
export function runManualBacktest({
  legs,
  priceData,
  symbol,
  entryDate,
  exitDate,
  dte = 30,
  riskFreeRate = 0.05,
  divYield = 0,
  startingCapital = 10000,
  commissionPerContract = 0.65,
  portfolioName,
}) {
  if (!legs || legs.length === 0) throw new Error('No legs provided');
  if (!priceData || priceData.length < 2) throw new Error('Insufficient price data');

  // Find entry index
  const entryIdx = priceData.findIndex((d) => d.date >= entryDate);
  if (entryIdx < 0) throw new Error(`Entry date ${entryDate} not found in price data`);

  const entryBar = priceData[entryIdx];
  const entrySpot = entryBar.close;
  const expDateStr = addDays(entryBar.date, dte);

  // Find exit index (if specified, else go to expiry or end of data)
  let endIdx = priceData.length - 1;
  if (exitDate) {
    const idx = priceData.findIndex((d) => d.date >= exitDate);
    if (idx >= 0) endIdx = idx;
  } else {
    const idx = priceData.findIndex((d) => d.date >= expDateStr);
    if (idx >= 0) endIdx = idx;
  }

  let portfolio = createPortfolio({
    name: portfolioName || `Manual: ${symbol} ${entryDate}`,
    mode: 'backtest',
    symbol,
  });
  portfolio.config.startingCapital = startingCapital;
  portfolio.config.commissionPerContract = commissionPerContract;

  // Create trades at entry
  for (const leg of legs) {
    const legIv = leg.iv || 0.30;
    const t = dte / 365;
    const prices = bsmPrice(entrySpot, leg.strike, t, riskFreeRate, legIv, divYield);
    const premium = leg.premium || (leg.type === 'call' ? prices.call : prices.put);

    const trade = createTrade({
      symbol,
      type: leg.type,
      direction: leg.direction,
      strike: leg.strike,
      premium: Math.round(premium * 100) / 100,
      quantity: leg.quantity || 1,
      iv: legIv,
      underlyingPrice: entrySpot,
      expiration: expDateStr,
    });
    trade._commission = commissionPerContract;
    portfolio = addTrade(portfolio, trade);
  }

  // Simulate forward from entry to exit
  for (let i = entryIdx; i <= endIdx; i++) {
    const bar = priceData[i];
    const spot = bar.close;
    const date = bar.date;

    // Check for expirations
    for (const trade of portfolio.trades) {
      if (trade.status === 'open' && date >= trade.expiration) {
        portfolio = expireTrade(portfolio, trade.id, spot);
      }
    }

    portfolio = takeSnapshot(portfolio, spot, date, riskFreeRate, divYield);
  }

  // If exit date reached and trades still open, close at exit price
  if (exitDate) {
    const exitBar = priceData[endIdx];
    for (const trade of portfolio.trades) {
      if (trade.status === 'open') {
        const daysLeft = Math.max(0, (new Date(trade.expiration) - new Date(exitBar.date)) / (1000 * 60 * 60 * 24));
        const t = daysLeft / 365;
        const prices = bsmPrice(exitBar.close, trade.strike, t, riskFreeRate, trade.iv, divYield);
        const exitPrice = trade.type === 'call' ? prices.call : prices.put;
        portfolio = closeTrade(portfolio, trade.id, Math.round(exitPrice * 100) / 100, exitBar.date);
      }
    }
  } else {
    // Hold to expiry — expire remaining
    const lastBar = priceData[endIdx];
    for (const trade of portfolio.trades) {
      if (trade.status === 'open') {
        portfolio = expireTrade(portfolio, trade.id, lastBar.close);
      }
    }
  }

  const metrics = calcMetrics(portfolio);
  return { portfolio, metrics, equityCurve: portfolio.snapshots };
}

/* ── Helpers ────────────────────────────────────────────── */

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function processOpenTrades(portfolio, spot, date, r, q, stopLossPct, takeProfitPct) {
  let updated = portfolio;
  for (const trade of updated.trades) {
    if (trade.status !== 'open') continue;

    // Check expiration
    if (date >= trade.expiration) {
      updated = expireTrade(updated, trade.id, spot);
      continue;
    }

    // Calculate current theoretical value
    const expDate = new Date(trade.expiration);
    const now = new Date(date);
    const daysLeft = Math.max(0, (expDate - now) / (1000 * 60 * 60 * 24));
    const t = daysLeft / 365;
    const prices = bsmPrice(spot, trade.strike, t, r, trade.iv, q);
    const currentPrice = trade.type === 'call' ? prices.call : prices.put;

    const dir = trade.direction === 'long' ? 1 : -1;
    const pnlPct = trade.premium > 0 ? dir * (currentPrice - trade.premium) / trade.premium : 0;

    // Stop loss
    if (stopLossPct > 0 && pnlPct <= -(stopLossPct / 100)) {
      updated = closeTrade(updated, trade.id, currentPrice, date);
      continue;
    }

    // Take profit
    if (takeProfitPct > 0 && pnlPct >= takeProfitPct / 100) {
      updated = closeTrade(updated, trade.id, currentPrice, date);
    }
  }
  return updated;
}
