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

/* ── Inverse normal CDF ──────────────────────────────────── */

/**
 * Rational approximation for the inverse normal CDF (Peter Acklam's algorithm).
 * Max absolute error ≈ 1.15 × 10⁻⁹ over the full domain.
 */
export function normalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [
    -3.969683028665376e+01,  2.209460984245205e+02,
    -2.759285104469687e+02,  1.383577518672690e+02,
    -3.066479806614716e+01,  2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01,  1.615858368580409e+02,
    -1.556989798598866e+02,  6.680131188771972e+01,
    -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
     4.374664141464968e+00,  2.938163982698783e+00,
  ];
  const d = [
     7.784695709041462e-03,  3.224671290700398e-01,
     2.445134137142996e+00,  3.754408661907416e+00,
  ];

  const pLow = 0.02425;
  let q, r;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= 1 - pLow) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
             ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

/**
 * Analytically compute the strike that produces a given unsigned delta.
 *
 * For calls:  Δ = e^{−qt} · N(d₁)   →  d₁ = N⁻¹(Δ / e^{−qt})
 * For puts:   Δ = e^{−qt} · N(d₁−1) →  d₁ = N⁻¹(1 − Δ / e^{−qt})
 * Then:       K = S · exp(−(d₁·σ√t − (r−q+σ²/2)·t))
 *
 * @param {number} S         - Spot price
 * @param {number} absDelta  - Unsigned target delta, e.g. 0.30 for the 30-delta option
 * @param {number} t         - Time to expiry in years
 * @param {number} r         - Risk-free rate
 * @param {number} sigma     - ATM implied volatility
 * @param {number} q         - Continuous dividend yield
 * @param {'call'|'put'} type
 * @returns {number} strike price
 */
export function strikeFromDelta(S, absDelta, t, r, sigma, q, type) {
  if (t <= 0 || sigma <= 0 || absDelta <= 0 || absDelta >= 1) return S;
  const eqt = Math.exp(-q * t);
  // N(d1) target differs for calls vs puts
  const nd1 = type === 'call'
    ? Math.min(1 - 1e-9, absDelta / eqt)
    : Math.max(1e-9, 1 - absDelta / eqt);
  const d1 = normalQuantile(nd1);
  const drift = (r - q + 0.5 * sigma * sigma) * t;
  return S * Math.exp(-(d1 * sigma * Math.sqrt(t) - drift));
}

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
