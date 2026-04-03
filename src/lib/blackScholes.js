/**
 * Black-Scholes-Merton pricing engine with analytical Greeks.
 * Zero dependencies — pure math.
 *
 * Conventions:
 *   S     = underlying spot price
 *   K     = strike price
 *   t     = time to expiry in years
 *   r     = risk-free rate (annualised, decimal)
 *   sigma = implied volatility (annualised, decimal)
 *   q     = continuous dividend yield (decimal)
 */

/* ── Normal distribution ─────────────────────────────────── */

export function normalPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** Abramowitz & Stegun approximation — max error ~1.5e-7 */
export function normalCDF(x) {
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * ax);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t) + a2) * t + a1) *
      t *
      Math.exp(-ax * ax);
  return 0.5 * (1.0 + sign * y);
}

/* ── BSM pricing ─────────────────────────────────────────── */

export function bsmPrice(S, K, t, r, sigma, q = 0) {
  if (t <= 0 || sigma <= 0) {
    const call = Math.max(S * Math.exp(-q * t) - K * Math.exp(-r * t), 0);
    const put = Math.max(K * Math.exp(-r * t) - S * Math.exp(-q * t), 0);
    return { call, put };
  }
  const sqrtT = Math.sqrt(t);
  const d1 =
    (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * t) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const call =
    S * Math.exp(-q * t) * normalCDF(d1) -
    K * Math.exp(-r * t) * normalCDF(d2);
  const put =
    K * Math.exp(-r * t) * normalCDF(-d2) -
    S * Math.exp(-q * t) * normalCDF(-d1);
  return { call: Math.max(call, 0), put: Math.max(put, 0) };
}

/* ── Analytical Greeks ───────────────────────────────────── */

export function bsmGreeks(S, K, t, r, sigma, q = 0) {
  if (t <= 1e-8 || sigma <= 1e-8) {
    const callItm = S > K ? 1 : 0;
    return {
      delta: { call: callItm, put: callItm - 1 },
      gamma: 0,
      theta: { call: 0, put: 0 },
      vega: 0,
    };
  }
  const sqrtT = Math.sqrt(t);
  const d1 =
    (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * t) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const nd1 = normalPDF(d1);
  const eqt = Math.exp(-q * t);
  const ert = Math.exp(-r * t);

  return {
    delta: {
      call: eqt * normalCDF(d1),
      put: eqt * (normalCDF(d1) - 1),
    },
    gamma: (eqt * nd1) / (S * sigma * sqrtT),
    theta: {
      call:
        (-S * eqt * nd1 * sigma) / (2 * sqrtT) -
        r * K * ert * normalCDF(d2) +
        q * S * eqt * normalCDF(d1),
      put:
        (-S * eqt * nd1 * sigma) / (2 * sqrtT) +
        r * K * ert * normalCDF(-d2) -
        q * S * eqt * normalCDF(-d1),
    },
    vega: (S * eqt * nd1 * sqrtT) / 100,
  };
}

/* ── Per-leg helpers ─────────────────────────────────────── */

/** P&L at expiry (intrinsic only) for a single leg. */
export function legPnlAtExpiry(leg, S) {
  const intrinsic =
    leg.type === 'call'
      ? Math.max(S - leg.strike, 0)
      : Math.max(leg.strike - S, 0);
  const dir = leg.direction === 'long' ? 1 : -1;
  return dir * (intrinsic - leg.premium) * leg.quantity * 100;
}

/** P&L at a given time-to-expiry using BSM theoretical value. */
export function legPnlAtTime(leg, S, t, r, q) {
  const prices = bsmPrice(S, leg.strike, t, r, leg.iv, q);
  const currentPrice = leg.type === 'call' ? prices.call : prices.put;
  const dir = leg.direction === 'long' ? 1 : -1;
  return dir * (currentPrice - leg.premium) * leg.quantity * 100;
}

/** Greeks for a single leg, scaled by quantity × 100 (contract multiplier). */
export function legGreeks(leg, S, t, r, q) {
  const g = bsmGreeks(S, leg.strike, t, r, leg.iv, q);
  const dir = leg.direction === 'long' ? 1 : -1;
  const qty = leg.quantity;
  return {
    delta: dir * qty * 100 * (leg.type === 'call' ? g.delta.call : g.delta.put),
    gamma: dir * qty * 100 * g.gamma,
    theta:
      (dir * qty * 100 * (leg.type === 'call' ? g.theta.call : g.theta.put)) /
      365,
    vega: dir * qty * 100 * g.vega,
  };
}
