/**
 * Backtesting engine for options strategies.
 *
 * Runs a strategy against historical price data, generating trades
 * and portfolio snapshots at each time step.
 */

import { bsmPrice, strikeFromDelta } from './blackScholes.js';
import {
  createPortfolio, createTrade, addTrade, closeTrade,
  expireTrade, takeSnapshot, calcMetrics, makeGroupId,
} from './portfolio.js';

/* ── Strategy definitions for backtesting ───────────────── */

/**
 * Strategy leg definitions.
 *
 * Each leg carries three strike-targeting fields so the engine can
 * resolve the actual strike at runtime in any of three modes:
 *   pct   — fixed % of spot (original behaviour; mode = 'pct')
 *   sigma — N standard-deviation move using ATM IV and DTE (mode = 'sigma')
 *   delta — target unsigned delta, solved analytically via BSM (mode = 'delta')
 *
 * The `iv` field is the pricing IV anchor (skew is applied on top).
 * Strategies no longer pre-compute the dollar strike — that is done by
 * resolveStrike() inside runBacktest so the same definition works for all modes.
 */
const BACKTEST_STRATEGIES = {
  // ── Directional / long premium ────────────────────────────
  'Long Call (ATM)': () => [
    { type: 'call', direction: 'long',  pct: 1.00, sigma:  0,    delta: 0.50, iv: 0.30, quantity: 1 },
  ],
  'Long Put (ATM)': () => [
    { type: 'put',  direction: 'long',  pct: 1.00, sigma:  0,    delta: 0.50, iv: 0.30, quantity: 1 },
  ],

  // Debit spreads
  'Bull Call Spread': () => [
    { type: 'call', direction: 'long',  pct: 0.97, sigma: -0.35, delta: 0.60, iv: 0.30, quantity: 1 },
    { type: 'call', direction: 'short', pct: 1.03, sigma:  0.35, delta: 0.40, iv: 0.28, quantity: 1 },
  ],
  'Bear Put Spread': () => [
    { type: 'put',  direction: 'long',  pct: 1.03, sigma:  0.35, delta: 0.60, iv: 0.30, quantity: 1 },
    { type: 'put',  direction: 'short', pct: 0.97, sigma: -0.35, delta: 0.40, iv: 0.28, quantity: 1 },
  ],

  // Classic multi-leg
  'Iron Condor': () => [
    { type: 'put',  direction: 'short', pct: 0.95, sigma: -0.50, delta: 0.20, iv: 0.28, quantity: 1 },
    { type: 'put',  direction: 'long',  pct: 0.90, sigma: -1.00, delta: 0.10, iv: 0.30, quantity: 1 },
    { type: 'call', direction: 'short', pct: 1.05, sigma:  0.50, delta: 0.20, iv: 0.28, quantity: 1 },
    { type: 'call', direction: 'long',  pct: 1.10, sigma:  1.00, delta: 0.10, iv: 0.30, quantity: 1 },
  ],
  'Straddle': () => [
    { type: 'call', direction: 'long',  pct: 1.00, sigma:  0,    delta: 0.50, iv: 0.30, quantity: 1 },
    { type: 'put',  direction: 'long',  pct: 1.00, sigma:  0,    delta: 0.50, iv: 0.30, quantity: 1 },
  ],
  'Strangle': () => [
    { type: 'call', direction: 'long',  pct: 1.05, sigma:  0.50, delta: 0.30, iv: 0.28, quantity: 1 },
    { type: 'put',  direction: 'long',  pct: 0.95, sigma: -0.50, delta: 0.30, iv: 0.28, quantity: 1 },
  ],
  'Covered Call': () => [
    { type: 'call', direction: 'short', pct: 1.05, sigma:  0.50, delta: 0.30, iv: 0.28, quantity: 1 },
  ],
  'Protective Put': () => [
    { type: 'put',  direction: 'long',  pct: 0.95, sigma: -0.50, delta: 0.30, iv: 0.30, quantity: 1 },
  ],
  'Butterfly Spread': () => [
    { type: 'call', direction: 'long',  pct: 0.95, sigma: -0.50, delta: 0.65, iv: 0.30, quantity: 1 },
    { type: 'call', direction: 'short', pct: 1.00, sigma:  0,    delta: 0.50, iv: 0.29, quantity: 2 },
    { type: 'call', direction: 'long',  pct: 1.05, sigma:  0.50, delta: 0.35, iv: 0.28, quantity: 1 },
  ],

  // ── Credit spreads ────────────────────────────────────────
  /** Short OTM put spread — bullish bias, collects credit. */
  'Bull Put Spread': () => [
    { type: 'put',  direction: 'short', pct: 0.97, sigma: -0.35, delta: 0.30, iv: 0.31, quantity: 1 },
    { type: 'put',  direction: 'long',  pct: 0.93, sigma: -0.80, delta: 0.15, iv: 0.33, quantity: 1 },
  ],
  /** Short OTM call spread — bearish bias, collects credit. */
  'Bear Call Spread': () => [
    { type: 'call', direction: 'short', pct: 1.03, sigma:  0.35, delta: 0.30, iv: 0.27, quantity: 1 },
    { type: 'call', direction: 'long',  pct: 1.07, sigma:  0.80, delta: 0.15, iv: 0.26, quantity: 1 },
  ],

  // ── Short premium (undefined risk) ───────────────────────
  /** Short ATM call + put — maximum theta decay, undefined risk. */
  'Short Straddle': () => [
    { type: 'call', direction: 'short', pct: 1.00, sigma:  0,    delta: 0.50, iv: 0.30, quantity: 1 },
    { type: 'put',  direction: 'short', pct: 1.00, sigma:  0,    delta: 0.50, iv: 0.30, quantity: 1 },
  ],
  /** Short OTM call + put — wider break-evens than Short Straddle. */
  'Short Strangle': () => [
    { type: 'call', direction: 'short', pct: 1.05, sigma:  0.50, delta: 0.25, iv: 0.28, quantity: 1 },
    { type: 'put',  direction: 'short', pct: 0.95, sigma: -0.50, delta: 0.25, iv: 0.30, quantity: 1 },
  ],
  /** Sell OTM put secured by cash — mildly bullish income strategy. */
  'Cash-Secured Put': () => [
    { type: 'put',  direction: 'short', pct: 0.95, sigma: -0.50, delta: 0.30, iv: 0.30, quantity: 1 },
  ],

  // ── Iron Butterfly ────────────────────────────────────────
  /** Short ATM straddle + protective OTM wings. */
  'Iron Butterfly': () => [
    { type: 'put',  direction: 'short', pct: 1.00, sigma:  0,    delta: 0.50, iv: 0.30, quantity: 1 },
    { type: 'put',  direction: 'long',  pct: 0.93, sigma: -0.80, delta: 0.15, iv: 0.33, quantity: 1 },
    { type: 'call', direction: 'short', pct: 1.00, sigma:  0,    delta: 0.50, iv: 0.30, quantity: 1 },
    { type: 'call', direction: 'long',  pct: 1.07, sigma:  0.80, delta: 0.15, iv: 0.27, quantity: 1 },
  ],

  // ── Ratio spreads ─────────────────────────────────────────
  /** Long 1 ATM call, short 2 OTM calls. */
  'Call Ratio Spread': () => [
    { type: 'call', direction: 'long',  pct: 1.00, sigma:  0,    delta: 0.50, iv: 0.30, quantity: 1 },
    { type: 'call', direction: 'short', pct: 1.05, sigma:  0.50, delta: 0.30, iv: 0.28, quantity: 2 },
  ],
  /** Long 1 ATM put, short 2 OTM puts. */
  'Put Ratio Spread': () => [
    { type: 'put',  direction: 'long',  pct: 1.00, sigma:  0,    delta: 0.50, iv: 0.30, quantity: 1 },
    { type: 'put',  direction: 'short', pct: 0.95, sigma: -0.50, delta: 0.30, iv: 0.32, quantity: 2 },
  ],

  // ── Asymmetric income ─────────────────────────────────────
  /** Short OTM put + bear call spread; no upside risk above the call spread. */
  'Jade Lizard': () => [
    { type: 'put',  direction: 'short', pct: 0.95, sigma: -0.50, delta: 0.25, iv: 0.32, quantity: 1 },
    { type: 'call', direction: 'short', pct: 1.05, sigma:  0.50, delta: 0.25, iv: 0.28, quantity: 1 },
    { type: 'call', direction: 'long',  pct: 1.08, sigma:  0.90, delta: 0.15, iv: 0.27, quantity: 1 },
  ],
  /**
   * Broken-wing put butterfly — wider lower wing, typically entered for a small credit.
   * Upper spread width ~3%, lower spread width ~8%.
   */
  'Put Broken-Wing Butterfly': () => [
    { type: 'put',  direction: 'long',  pct: 0.98, sigma: -0.20, delta: 0.45, iv: 0.30, quantity: 1 },
    { type: 'put',  direction: 'short', pct: 0.95, sigma: -0.50, delta: 0.30, iv: 0.31, quantity: 2 },
    { type: 'put',  direction: 'long',  pct: 0.87, sigma: -1.50, delta: 0.10, iv: 0.35, quantity: 1 },
  ],

  // ── Multi-expiry strategies (per-leg dte field) ───────────
  /**
   * Short ATM call (global DTE) vs long same-strike call (2× DTE).
   * sigma=0 keeps both legs ATM regardless of mode.
   */
  'Calendar Spread (Call)': () => [
    { type: 'call', direction: 'short', pct: 1.00, sigma: 0, delta: 0.50, iv: 0.30, quantity: 1 },
    { type: 'call', direction: 'long',  pct: 1.00, sigma: 0, delta: 0.50, iv: 0.28, quantity: 1, dte: 60 },
  ],
  /**
   * Long deep-ITM call (90 DTE) as stock substitute; short OTM call (global DTE) for income.
   * pct=0.80 / sigma=-1.5 / delta=0.80 all target a high-delta long leg.
   */
  'PMCC': () => [
    { type: 'call', direction: 'long',  pct: 0.80, sigma: -1.50, delta: 0.80, iv: 0.28, quantity: 1, dte: 90 },
    { type: 'call', direction: 'short', pct: 1.05, sigma:  0.50, delta: 0.25, iv: 0.27, quantity: 1 },
  ],
};

export const STRATEGY_NAMES = Object.keys(BACKTEST_STRATEGIES);

/**
 * Run a backtest.
 *
 * @param {Object} config
 * @param {string} config.strategy - One of STRATEGY_NAMES
 * @param {Array}  config.priceData - Array of { date, open, high, low, close, volume }
 * @param {string} config.symbol
 * @param {number} [config.dte=30] - Days to expiry for each trade
 * @param {number} [config.entryInterval=30] - Days between new entries
 * @param {number} [config.iv=0.30] - ATM implied volatility
 * @param {number} [config.riskFreeRate=0.05]
 * @param {number} [config.divYield=0]
 * @param {number} [config.startingCapital=10000]
 * @param {number} [config.commissionPerContract=0.65]
 * @param {number} [config.stopLossPct=0] - Stop loss % of premium (0 = disabled)
 * @param {number} [config.takeProfitPct=0] - Take profit % of premium (0 = disabled)
 * @param {number} [config.trailingStopPct=0] - Trailing stop % drop from peak P&L (0 = disabled)
 * @param {number} [config.managementDte=0] - Close when DTE remaining <= this value (0 = disabled)
 * @param {number} [config.bidAskSpread=0] - Half bid-ask spread as fraction of option price (0 = no slippage)
 * @param {string} [config.positionSizing='fixed'] - 'fixed' (1 contract) or 'fractional' (size by riskPct)
 * @param {number} [config.riskPct=2] - % of current capital to risk per trade (for 'fractional' sizing)
 * @param {number} [config.skewSlope=0] - Vol skew slope (e.g. -0.5 = typical equity skew; 0 = flat)
 * @param {'pct'|'sigma'|'delta'} [config.strikeMode='pct'] - Strike resolution mode
 * @param {number} [config.strikeIncrement=0] - Snap resolved strikes to this grid (0 = nearest integer)
 * @param {Object} [config.existingPortfolio] - Append to this portfolio instead of creating a new one
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
  trailingStopPct = 0,
  managementDte = 0,
  bidAskSpread = 0,
  positionSizing = 'fixed',
  riskPct = 2,
  skewSlope = 0,
  strikeMode = 'pct',
  strikeIncrement = 0,
  existingPortfolio,
}) {
  const strategyFn = BACKTEST_STRATEGIES[strategy];
  if (!strategyFn) throw new Error(`Unknown strategy: ${strategy}`);
  if (!priceData || priceData.length < 2) throw new Error('Insufficient price data');

  let portfolio;
  if (existingPortfolio) {
    portfolio = existingPortfolio;
  } else {
    portfolio = createPortfolio({ name: `Backtest: ${strategy}`, mode: 'backtest', symbol });
    portfolio.config.startingCapital = startingCapital;
    portfolio.config.commissionPerContract = commissionPerContract;
  }

  // daysSinceEntry starts at entryInterval so a signal fires on bar 0,
  // but execution is deferred to bar 1 (look-ahead fix).
  let daysSinceEntry = entryInterval;
  let pendingEntry = null; // { legs, gid, signalSpot }

  for (let i = 0; i < priceData.length; i++) {
    const bar = priceData[i];
    const date = bar.date;
    // Use today's open for execution (next-bar fill); fall back to close if open missing.
    const executionSpot = bar.open ?? bar.close;
    const spot = bar.close;

    // ── Execute deferred entry from previous bar's signal ──────────────────
    if (pendingEntry) {
      const { legs: pendingLegs, gid } = pendingEntry;

      // Step 1 — resolve strikes for all legs (mode-aware, then snapped to increment)
      const resolvedLegs = pendingLegs.map((leg) => {
        const legDte = leg.dte ?? dte;
        const strike = resolveStrike(leg, executionSpot, strikeMode, iv, legDte, riskFreeRate, divYield, strikeIncrement);
        return { ...leg, strike };
      });

      // Step 2 — determine quantity based on position sizing
      const currentCapital =
        portfolio.snapshots.length > 0
          ? portfolio.snapshots[portfolio.snapshots.length - 1].totalValue
          : startingCapital;
      const qty = calcEntryQuantity(
        resolvedLegs, executionSpot, dte, riskFreeRate, divYield,
        positionSizing, riskPct, currentCapital,
      );

      for (const leg of resolvedLegs) {
        // Per-leg DTE: strategies like Calendar/PMCC set leg.dte on individual legs
        const legDte = leg.dte ?? dte;
        const legExpDate = addDays(date, legDte);
        const legIv = applySkew(leg.iv || iv, leg.strike, executionSpot, skewSlope);
        const t = legDte / 365;
        const prices = bsmPrice(executionSpot, leg.strike, t, riskFreeRate, legIv, divYield);
        const midPrice = leg.type === 'call' ? prices.call : prices.put;

        // Apply bid-ask spread: longs buy at ask, shorts sell at bid
        const dir = leg.direction === 'long' ? 1 : -1;
        const slipFactor = bidAskSpread > 0
          ? (dir > 0 ? 1 + bidAskSpread / 2 : 1 - bidAskSpread / 2)
          : 1;
        const premium = midPrice * slipFactor;

        const trade = createTrade({
          symbol,
          type: leg.type,
          direction: leg.direction,
          strike: leg.strike,
          premium: Math.round(premium * 100) / 100,
          quantity: qty,
          iv: legIv,
          underlyingPrice: executionSpot,
          expiration: legExpDate,
          groupId: gid,
          openedAt: date,
        });
        trade._commission = commissionPerContract;
        portfolio = addTrade(portfolio, trade);
      }
      pendingEntry = null;
      daysSinceEntry = 0;
    }

    // ── Process open trades: expirations, exits, stop/take-profit ──────────
    portfolio = processOpenTrades(
      portfolio, spot, date, riskFreeRate, divYield,
      stopLossPct, takeProfitPct, trailingStopPct, managementDte, bidAskSpread,
    );

    // ── Check entry condition — signal uses today's close (no look-ahead) ──
    daysSinceEntry++;
    if (daysSinceEntry >= entryInterval) {
      const legs = strategyFn(); // returns pct/sigma/delta specs; strike resolved at execution
      pendingEntry = {
        legs,
        gid: makeGroupId(),
        signalSpot: spot,
        // expDate is computed per-leg at execution time using leg.dte ?? dte
      };
      // daysSinceEntry reset happens when entry is executed on the next bar
    }

    // ── Daily snapshot ─────────────────────────────────────────────────────
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
 * @param {Array}  config.legs - Array of { type, direction, strike, iv, quantity, premium?, dte? }
 * @param {Array}  config.priceData - Array of { date, close, ... } (full history)
 * @param {string} config.symbol
 * @param {string} config.entryDate - ISO date string to enter the trade
 * @param {string} [config.exitDate] - ISO date string to exit (or hold to expiry)
 * @param {number} [config.dte=30] - Days to expiry from entry date
 * @param {number} [config.riskFreeRate=0.05]
 * @param {number} [config.divYield=0]
 * @param {number} [config.startingCapital=10000]
 * @param {number} [config.commissionPerContract=0.65]
 * @param {string} [config.portfolioName]
 * @param {Object} [config.existingPortfolio] - Append to this portfolio instead of creating a new one
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
  existingPortfolio,
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

  let portfolio;
  if (existingPortfolio) {
    portfolio = existingPortfolio;
  } else {
    portfolio = createPortfolio({
      name: portfolioName || `Manual: ${symbol} ${entryDate}`,
      mode: 'backtest',
      symbol,
    });
    portfolio.config.startingCapital = startingCapital;
    portfolio.config.commissionPerContract = commissionPerContract;
  }

  // Create trades at entry — all legs share one groupId
  const gid = makeGroupId();
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
      groupId: gid,
      openedAt: entryBar.date,
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

/**
 * Snap a raw strike to the nearest valid increment.
 * increment = 0 → round to nearest integer (default for individual stocks).
 */
function snapStrike(raw, increment) {
  if (!increment || increment <= 0) return Math.round(raw);
  return Math.round(raw / increment) * increment;
}

/**
 * Resolve the dollar strike for a leg based on the selected strike mode,
 * then snap it to the configured increment.
 *
 * @param {Object} leg          - Leg spec with pct, sigma, delta fields
 * @param {number} S            - Current spot price
 * @param {'pct'|'sigma'|'delta'} mode
 * @param {number} atmIv        - User-configured ATM IV (used for sigma/delta math)
 * @param {number} legDte       - This leg's DTE in days
 * @param {number} r            - Risk-free rate
 * @param {number} q            - Dividend yield
 * @param {number} increment    - Strike grid size (0 = nearest integer)
 */
function resolveStrike(leg, S, mode, atmIv, legDte, r, q, increment) {
  const t = legDte / 365;
  let raw;

  if (mode === 'sigma') {
    // Place strike N standard-deviation moves from spot using ATM IV and DTE.
    // sigma > 0 → above spot (call side); sigma < 0 → below spot (put side).
    raw = S * Math.exp((leg.sigma ?? 0) * atmIv * Math.sqrt(t));
  } else if (mode === 'delta') {
    // Solve analytically for the strike that produces the target unsigned delta.
    raw = strikeFromDelta(S, leg.delta ?? 0.50, t, r, atmIv, q, leg.type);
  } else {
    // 'pct' mode — fixed percentage of spot (original behaviour)
    raw = S * (leg.pct ?? 1.0);
  }

  return snapStrike(raw, increment);
}

/**
 * Apply a simple linear vol skew to an option's IV based on moneyness.
 * skewSlope < 0 (e.g. -0.5) replicates typical equity skew:
 *   OTM puts (strike < spot) get higher IV; OTM calls get lower IV.
 */
function applySkew(baseIv, strike, spot, skewSlope) {
  if (!skewSlope || spot <= 0) return baseIv;
  const moneyness = strike / spot - 1; // negative for OTM put, positive for OTM call
  return Math.max(0.05, baseIv * (1 + skewSlope * moneyness));
}

/**
 * Calculate entry quantity for position sizing.
 * 'fixed'      → always 1 contract per leg.
 * 'fractional' → size so net debit ≈ riskPct% of current capital.
 *                Credit strategies default to 1 contract (max loss unknown without spread width).
 */
function calcEntryQuantity(legs, spot, defaultDte, r, q, positionSizing, riskPct, capital) {
  if (positionSizing !== 'fractional') return 1;

  // Net debit/credit per 1 contract unit (respects per-leg DTE overrides)
  let netCost = 0;
  for (const leg of legs) {
    const legDte = leg.dte ?? defaultDte;
    const t = legDte / 365;
    const prices = bsmPrice(spot, leg.strike, t, r, leg.iv, q);
    const mid = leg.type === 'call' ? prices.call : prices.put;
    netCost += (leg.direction === 'long' ? 1 : -1) * mid * 100;
  }

  if (netCost > 0) {
    // Debit strategy: target risk = net premium paid
    const targetRisk = capital * (riskPct / 100);
    return Math.max(1, Math.floor(targetRisk / netCost));
  }
  // Credit strategy: fall back to 1 contract
  return 1;
}

/**
 * Process all open trades for the current bar:
 * - Expire trades that have reached their expiry date.
 * - Apply management DTE close.
 * - Apply stop-loss, take-profit, and trailing stop.
 * Bid-ask spread slippage is applied to all exit prices.
 */
function processOpenTrades(
  portfolio, spot, date, r, q,
  stopLossPct, takeProfitPct, trailingStopPct, managementDte, bidAskSpread,
) {
  // First pass: update the peak P&L tracker for trailing stops (immutable update)
  let updated = portfolio;
  if (trailingStopPct > 0) {
    const newTrades = portfolio.trades.map((trade) => {
      if (trade.status !== 'open' || date >= trade.expiration) return trade;
      const expDate = new Date(trade.expiration);
      const now = new Date(date);
      const daysLeft = Math.max(0, (expDate - now) / (1000 * 60 * 60 * 24));
      const t = daysLeft / 365;
      const prices = bsmPrice(spot, trade.strike, t, r, trade.iv, q);
      const mid = trade.type === 'call' ? prices.call : prices.put;
      const dir = trade.direction === 'long' ? 1 : -1;
      const pnlPct = trade.premium > 0 ? dir * (mid - trade.premium) / trade.premium : 0;
      const newPeak = Math.max(trade._maxPnlPct ?? -Infinity, pnlPct);
      return newPeak !== trade._maxPnlPct ? { ...trade, _maxPnlPct: newPeak } : trade;
    });
    updated = { ...portfolio, trades: newTrades };
  }

  // Second pass: evaluate exit conditions
  for (const trade of updated.trades) {
    if (trade.status !== 'open') continue;

    // Expiration
    if (date >= trade.expiration) {
      updated = expireTrade(updated, trade.id, spot);
      continue;
    }

    const expDate = new Date(trade.expiration);
    const now = new Date(date);
    const daysLeft = Math.max(0, (expDate - now) / (1000 * 60 * 60 * 24));
    const t = daysLeft / 365;
    const prices = bsmPrice(spot, trade.strike, t, r, trade.iv, q);
    const mid = trade.type === 'call' ? prices.call : prices.put;
    const dir = trade.direction === 'long' ? 1 : -1;
    const pnlPct = trade.premium > 0 ? dir * (mid - trade.premium) / trade.premium : 0;

    // Exit price after bid-ask slippage (long sells at bid, short buys at ask)
    const exitSlip = bidAskSpread > 0
      ? (dir > 0 ? 1 - bidAskSpread / 2 : 1 + bidAskSpread / 2)
      : 1;
    const exitPrice = Math.max(0, mid * exitSlip);

    // Management DTE: close when time remaining hits threshold
    if (managementDte > 0 && daysLeft <= managementDte) {
      updated = closeTrade(updated, trade.id, exitPrice, date);
      continue;
    }

    // Stop loss
    if (stopLossPct > 0 && pnlPct <= -(stopLossPct / 100)) {
      updated = closeTrade(updated, trade.id, exitPrice, date);
      continue;
    }

    // Take profit
    if (takeProfitPct > 0 && pnlPct >= takeProfitPct / 100) {
      updated = closeTrade(updated, trade.id, exitPrice, date);
      continue;
    }

    // Trailing stop: close if P&L has dropped by trailingStopPct from its peak
    if (trailingStopPct > 0 && (trade._maxPnlPct ?? -Infinity) > 0) {
      const dropFromPeak = (trade._maxPnlPct ?? 0) - pnlPct;
      if (dropFromPeak >= trailingStopPct / 100) {
        updated = closeTrade(updated, trade.id, exitPrice, date);
      }
    }
  }
  return updated;
}
