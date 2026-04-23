// Single source of truth for number formatting across the app.
// Matches the previous duplicated fmtMoney / fmtPct / fmtNum helpers.

export function formatCurrency(n, { decimals = 2 } = {}) {
  if (n == null || isNaN(n)) return '$0.00';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatPercent(n, decimals = 1) {
  if (n == null || isNaN(n)) return '0.0%';
  return `${(n * 100).toFixed(decimals)}%`;
}

export function formatNumber(n, decimals = 2) {
  if (n == null || isNaN(n)) return '0.00';
  return Math.abs(n) < Math.pow(10, -decimals) / 2 ? (0).toFixed(decimals) : n.toFixed(decimals);
}

export function formatCompact(n) {
  if (n == null || isNaN(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

export function formatSigned(n, formatter = formatCurrency) {
  if (n == null || isNaN(n)) return formatter(0);
  return `${n >= 0 ? '+' : ''}${formatter(n)}`;
}
