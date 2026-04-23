/**
 * Portfolio tracking engine for backtesting and forward testing.
 *
 * Manages trades, positions, P&L snapshots, and performance metrics.
 * Persists to localStorage for forward-testing continuity.
 */

import { bsmPrice, legGreeks } from './blackScholes.js';

/* ── ID generation ──────────────────────────────────────── */

let _tradeSeq = Date.now();
export const makeTradeId = () => `trade-${_tradeSeq++}`;
export const makePortfolioId = () => `pf-${_tradeSeq++}`;
export const makeGroupId = () => `grp-${_tradeSeq++}`;

/* ── Trade record ───────────────────────────────────────── */

/**
 * Create a trade record from a leg + execution info.
 * @param {Object} params
 * @param {string} params.symbol - Underlying ticker
 * @param {'call'|'put'} params.type
 * @param {'long'|'short'} params.direction
 * @param {number} params.strike
 * @param {number} params.premium - Fill price per share
 * @param {number} params.quantity - Number of contracts
 * @param {number} params.iv - Implied vol at entry
 * @param {number} params.underlyingPrice - Spot at entry
 * @param {string} params.expiration - ISO date string (YYYY-MM-DD)
 * @param {string} [params.notes]
 */
export function createTrade({
  symbol, type, direction, strike, premium, quantity,
  iv, underlyingPrice, expiration, notes = '', groupId = null, openedAt = null,
}) {
  return {
    id: makeTradeId(),
    groupId: groupId || makeGroupId(),
    symbol: symbol.toUpperCase(),
    type,
    direction,
    strike,
    premium,
    quantity,
    iv,
    underlyingPrice,
    expiration,
    notes,
    openedAt: openedAt || new Date().toISOString(),
    closedAt: null,
    closePrice: null,
    closeSpotPrice: null,
    status: 'open', // 'open' | 'closed' | 'expired'
  };
}

/* ── Portfolio container ────────────────────────────────── */

export function createPortfolio({ name, mode, symbol = '' }) {
  return {
    id: makePortfolioId(),
    name,
    mode, // 'backtest' | 'forward'
    symbol,
    trades: [],
    snapshots: [], // { date, totalValue, realizedPnl, unrealizedPnl, spotPrice, delta, gamma, theta, vega }
    createdAt: new Date().toISOString(),
    config: {
      startingCapital: 10000,
      commissionPerContract: 0.65,
      slippage: 0, // cents per contract
    },
  };
}

/* ── Trade operations ───────────────────────────────────── */

export function addTrade(portfolio, trade) {
  return { ...portfolio, trades: [...portfolio.trades, trade] };
}

export function closeTrade(portfolio, tradeId, closePrice, closedAt = null, closeSpotPrice = null) {
  return {
    ...portfolio,
    trades: portfolio.trades.map((t) =>
      t.id === tradeId
        ? {
            ...t,
            closePrice,
            closedAt: closedAt || new Date().toISOString(),
            closeSpotPrice: closeSpotPrice ?? t.closeSpotPrice ?? null,
            status: 'closed',
          }
        : t
    ),
  };
}

export function expireTrade(portfolio, tradeId, spotAtExpiry) {
  return {
    ...portfolio,
    trades: portfolio.trades.map((t) => {
      if (t.id !== tradeId) return t;
      const intrinsic =
        t.type === 'call'
          ? Math.max(spotAtExpiry - t.strike, 0)
          : Math.max(t.strike - spotAtExpiry, 0);
      return {
        ...t,
        closePrice: intrinsic,
        closedAt: t.expiration,
        closeSpotPrice: spotAtExpiry,
        status: 'expired',
      };
    }),
  };
}

/* ── P&L calculations ───────────────────────────────────── */

export function tradePnl(trade, currentSpot, currentDate, riskFreeRate = 0.05, divYield = 0) {
  const dir = trade.direction === 'long' ? 1 : -1;
  const multiplier = trade.quantity * 100;
  const commission = trade.quantity * (trade._commission ?? 0.65);

  if (trade.status === 'closed' || trade.status === 'expired') {
    const pnl = dir * (trade.closePrice - trade.premium) * multiplier;
    return { realized: pnl - commission * 2, unrealized: 0, total: pnl - commission * 2 };
  }

  // Open position — use BSM to get current theoretical value
  const expDate = new Date(trade.expiration);
  const now = currentDate ? new Date(currentDate) : new Date();
  const daysLeft = Math.max(0, (expDate - now) / (1000 * 60 * 60 * 24));
  const t = daysLeft / 365;

  const prices = bsmPrice(currentSpot, trade.strike, t, riskFreeRate, trade.iv, divYield);
  const currentPrice = trade.type === 'call' ? prices.call : prices.put;
  const unrealized = dir * (currentPrice - trade.premium) * multiplier - commission;

  return { realized: 0, unrealized, total: unrealized };
}

export function portfolioPnl(portfolio, currentSpot, currentDate, riskFreeRate = 0.05, divYield = 0) {
  let realized = 0;
  let unrealized = 0;

  for (const trade of portfolio.trades) {
    const pnl = tradePnl(trade, currentSpot, currentDate, riskFreeRate, divYield);
    realized += pnl.realized;
    unrealized += pnl.unrealized;
  }

  return { realized, unrealized, total: realized + unrealized };
}

/* ── Portfolio Greeks ───────────────────────────────────── */

export function portfolioGreeks(portfolio, currentSpot, currentDate, riskFreeRate = 0.05, divYield = 0) {
  const net = { delta: 0, gamma: 0, theta: 0, vega: 0 };
  const now = currentDate ? new Date(currentDate) : new Date();

  for (const trade of portfolio.trades) {
    if (trade.status !== 'open') continue;
    const expDate = new Date(trade.expiration);
    const daysLeft = Math.max(0, (expDate - now) / (1000 * 60 * 60 * 24));
    const t = daysLeft / 365;

    const leg = {
      type: trade.type,
      direction: trade.direction,
      strike: trade.strike,
      iv: trade.iv,
      quantity: trade.quantity,
    };

    const g = legGreeks(leg, currentSpot, t, riskFreeRate, divYield);
    net.delta += g.delta;
    net.gamma += g.gamma;
    net.theta += g.theta;
    net.vega += g.vega;
  }

  return net;
}

/* ── Snapshots ──────────────────────────────────────────── */

export function takeSnapshot(portfolio, spotPrice, date, riskFreeRate = 0.05, divYield = 0) {
  const pnl = portfolioPnl(portfolio, spotPrice, date, riskFreeRate, divYield);
  const greeks = portfolioGreeks(portfolio, spotPrice, date, riskFreeRate, divYield);
  const snapshot = {
    date: date || new Date().toISOString().slice(0, 10),
    spotPrice,
    realizedPnl: Math.round(pnl.realized * 100) / 100,
    unrealizedPnl: Math.round(pnl.unrealized * 100) / 100,
    totalPnl: Math.round(pnl.total * 100) / 100,
    totalValue: Math.round((portfolio.config.startingCapital + pnl.total) * 100) / 100,
    openPositions: portfolio.trades.filter((t) => t.status === 'open').length,
    delta: Math.round(greeks.delta * 100) / 100,
    gamma: Math.round(greeks.gamma * 10000) / 10000,
    theta: Math.round(greeks.theta * 100) / 100,
    vega: Math.round(greeks.vega * 100) / 100,
  };
  return { ...portfolio, snapshots: [...portfolio.snapshots, snapshot] };
}

/* ── Performance metrics ────────────────────────────────── */

export function calcMetrics(portfolio) {
  const closed = portfolio.trades.filter((t) => t.status !== 'open');
  if (closed.length === 0) {
    return {
      totalTrades: 0, winners: 0, losers: 0, winRate: 0,
      avgWin: 0, avgLoss: 0, profitFactor: 0, totalPnl: 0,
      maxDrawdown: 0, sharpe: 0, sortino: 0, calmar: 0,
      maxConsecLosers: 0, yearlyReturns: [],
    };
  }

  const commissionPerContract = portfolio.config?.commissionPerContract ?? 0.65;

  // Group closed trades by groupId to evaluate multi-leg strategies as one trade
  const groups = {};
  for (const t of closed) {
    const gid = t.groupId || t.id; // fallback for legacy trades without groupId
    if (!groups[gid]) groups[gid] = [];
    groups[gid].push(t);
  }

  // Calculate combined P&L per group
  const pnls = Object.values(groups).map((legs) => {
    let groupPnl = 0;
    for (const t of legs) {
      const dir = t.direction === 'long' ? 1 : -1;
      const commission = t.quantity * (t._commission ?? commissionPerContract);
      groupPnl += dir * ((t.closePrice ?? t.premium) - t.premium) * t.quantity * 100 - commission * 2;
    }
    return groupPnl;
  });

  const winners = pnls.filter((p) => p > 0);
  const losers = pnls.filter((p) => p < 0);
  const totalPnl = pnls.reduce((s, p) => s + p, 0);
  const grossWin = winners.reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(losers.reduce((s, p) => s + p, 0));

  // Max consecutive losers
  let maxConsecLosers = 0;
  let consecLosers = 0;
  for (const p of pnls) {
    if (p < 0) {
      consecLosers++;
      if (consecLosers > maxConsecLosers) maxConsecLosers = consecLosers;
    } else {
      consecLosers = 0;
    }
  }

  // Max drawdown from snapshots
  let maxDrawdown = 0;
  let peak = portfolio.config.startingCapital;
  for (const snap of portfolio.snapshots) {
    if (snap.totalValue > peak) peak = snap.totalValue;
    const dd = (peak - snap.totalValue) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Daily returns for Sharpe and Sortino
  let sharpe = 0;
  let sortino = 0;
  if (portfolio.snapshots.length > 2) {
    const returns = [];
    for (let i = 1; i < portfolio.snapshots.length; i++) {
      const prev = portfolio.snapshots[i - 1].totalValue;
      if (prev > 0) returns.push((portfolio.snapshots[i].totalValue - prev) / prev);
    }
    if (returns.length > 1) {
      const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
      const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
      const std = Math.sqrt(variance);
      if (std > 0) sharpe = (mean / std) * Math.sqrt(252);

      // Sortino: penalise downside deviation only (use target return = 0)
      const downsideReturns = returns.filter((r) => r < 0);
      if (downsideReturns.length > 0) {
        const downsideVariance = downsideReturns.reduce((s, r) => s + r * r, 0) / downsideReturns.length;
        const downsideStd = Math.sqrt(downsideVariance);
        if (downsideStd > 0) sortino = (mean / downsideStd) * Math.sqrt(252);
      }
    }
  }

  // Calmar ratio: annualised return / max drawdown
  let calmar = 0;
  if (portfolio.snapshots.length > 1 && maxDrawdown > 0) {
    const firstSnap = portfolio.snapshots[0];
    const lastSnap = portfolio.snapshots[portfolio.snapshots.length - 1];
    const snapDays = portfolio.snapshots.length;
    if (firstSnap.totalValue > 0) {
      const annualisedReturn =
        Math.pow(lastSnap.totalValue / firstSnap.totalValue, 252 / snapDays) - 1;
      calmar = annualisedReturn / maxDrawdown;
    }
  }

  // Per-year return breakdown
  const yearMap = {};
  for (const snap of portfolio.snapshots) {
    const year = snap.date ? snap.date.slice(0, 4) : null;
    if (!year) continue;
    if (!yearMap[year]) yearMap[year] = { startValue: snap.totalValue, endValue: snap.totalValue };
    yearMap[year].endValue = snap.totalValue;
  }
  const yearlyReturns = Object.entries(yearMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, { startValue, endValue }]) => ({
      year,
      returnPct: startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0,
      pnl: endValue - startValue,
    }));

  const totalGroups = pnls.length;
  return {
    totalTrades: totalGroups,
    winners: winners.length,
    losers: losers.length,
    winRate: totalGroups > 0 ? winners.length / totalGroups : 0,
    avgWin: winners.length > 0 ? grossWin / winners.length : 0,
    avgLoss: losers.length > 0 ? grossLoss / losers.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    totalPnl,
    maxDrawdown,
    sharpe,
    sortino,
    calmar,
    maxConsecLosers,
    yearlyReturns,
  };
}

/* ── localStorage persistence ───────────────────────────── */

const STORAGE_KEY = 'options_sim_portfolios';

export function loadPortfolios() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePortfolios(portfolios) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolios));
  } catch {
    // localStorage full or unavailable
  }
}

export function deletePortfolio(portfolios, portfolioId) {
  return portfolios.filter((p) => p.id !== portfolioId);
}

export function deleteTrade(portfolio, tradeId) {
  return { ...portfolio, trades: portfolio.trades.filter((t) => t.id !== tradeId) };
}
