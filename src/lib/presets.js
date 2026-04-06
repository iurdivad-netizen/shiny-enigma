export const LEG_COLORS = [
  '#06b6d4', '#f97316', '#a855f7', '#ec4899', '#84cc16', '#facc15',
];

export const CATEGORIES = ['Bullish', 'Bearish', 'Neutral', 'Volatile'];

export const CAT_COLORS = {
  Bullish: '#22c55e',
  Bearish: '#ef4444',
  Neutral: '#60a5fa',
  Volatile: '#f59e0b',
};

/**
 * Each preset is a function of the underlying spot price S,
 * returning an array of leg definitions.
 * Premiums are auto-calculated via BSM when loaded.
 */
export const PRESETS = {
  'Long Call': {
    category: 'Bullish',
    icon: '↗',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
    ],
  },
  'Long Put': {
    category: 'Bearish',
    icon: '↘',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
    ],
  },
  'Covered Call': {
    category: 'Neutral',
    icon: '◫',
    legs: (S) => [
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
    ],
  },
  'Bull Call Spread': {
    category: 'Bullish',
    icon: '⬈',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S * 0.97), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
    ],
  },
  'Bear Put Spread': {
    category: 'Bearish',
    icon: '⬊',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S * 1.03), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S * 0.95), iv: 0.28, quantity: 1 },
    ],
  },
  'Long Straddle': {
    category: 'Volatile',
    icon: '⟷',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
    ],
  },
  'Long Strangle': {
    category: 'Volatile',
    icon: '↔',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
      { type: 'put', direction: 'long', strike: Math.round(S * 0.95), iv: 0.28, quantity: 1 },
    ],
  },
  'Short Straddle': {
    category: 'Neutral',
    icon: '⊕',
    legs: (S) => [
      { type: 'call', direction: 'short', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S), iv: 0.30, quantity: 1 },
    ],
  },
  'Iron Condor': {
    category: 'Neutral',
    icon: '◆',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S * 0.90), iv: 0.32, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
      { type: 'call', direction: 'long', strike: Math.round(S * 1.10), iv: 0.30, quantity: 1 },
    ],
  },
  'Butterfly': {
    category: 'Neutral',
    icon: '🦋',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S), iv: 0.28, quantity: 2 },
      { type: 'call', direction: 'long', strike: Math.round(S * 1.05), iv: 0.30, quantity: 1 },
    ],
  },
  'Iron Butterfly': {
    category: 'Neutral',
    icon: '⬥',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S * 0.93), iv: 0.32, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S), iv: 0.28, quantity: 1 },
      { type: 'call', direction: 'long', strike: Math.round(S * 1.07), iv: 0.30, quantity: 1 },
    ],
  },
  'Call Ratio Spread': {
    category: 'Bullish',
    icon: '⫽',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.07), iv: 0.27, quantity: 2 },
    ],
  },

  /* ── Additional Bullish ─────────────────────────── */

  'Bull Put Spread': {
    category: 'Bullish',
    icon: '⤴',
    legs: (S) => [
      { type: 'put', direction: 'short', strike: Math.round(S * 0.97), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'long', strike: Math.round(S * 0.90), iv: 0.32, quantity: 1 },
    ],
  },
  'Synthetic Long': {
    category: 'Bullish',
    icon: '⇈',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S), iv: 0.30, quantity: 1 },
    ],
  },
  'Call Backspread': {
    category: 'Bullish',
    icon: '⋰',
    legs: (S) => [
      { type: 'call', direction: 'short', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'long', strike: Math.round(S * 1.05), iv: 0.28, quantity: 2 },
    ],
  },

  /* ── Additional Bearish ─────────────────────────── */

  'Bear Call Spread': {
    category: 'Bearish',
    icon: '⤵',
    legs: (S) => [
      { type: 'call', direction: 'short', strike: Math.round(S * 1.03), iv: 0.28, quantity: 1 },
      { type: 'call', direction: 'long', strike: Math.round(S * 1.10), iv: 0.30, quantity: 1 },
    ],
  },
  'Put Ratio Spread': {
    category: 'Bearish',
    icon: '⫻',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S * 0.93), iv: 0.27, quantity: 2 },
    ],
  },
  'Synthetic Short': {
    category: 'Bearish',
    icon: '⇊',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S), iv: 0.30, quantity: 1 },
    ],
  },
  'Put Backspread': {
    category: 'Bearish',
    icon: '⋱',
    legs: (S) => [
      { type: 'put', direction: 'short', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'long', strike: Math.round(S * 0.95), iv: 0.28, quantity: 2 },
    ],
  },

  /* ── Additional Neutral / Income ────────────────── */

  'Short Strangle': {
    category: 'Neutral',
    icon: '⊖',
    legs: (S) => [
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S * 0.95), iv: 0.28, quantity: 1 },
    ],
  },
  'Short Put': {
    category: 'Neutral',
    icon: '⊟',
    legs: (S) => [
      { type: 'put', direction: 'short', strike: Math.round(S * 0.95), iv: 0.28, quantity: 1 },
    ],
  },
  'Short Call': {
    category: 'Neutral',
    icon: '⊠',
    legs: (S) => [
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
    ],
  },
  'Jade Lizard': {
    category: 'Neutral',
    icon: '🦎',
    legs: (S) => [
      { type: 'put', direction: 'short', strike: Math.round(S * 0.95), iv: 0.28, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
      { type: 'call', direction: 'long', strike: Math.round(S * 1.10), iv: 0.30, quantity: 1 },
    ],
  },
  'Broken Wing Butterfly': {
    category: 'Neutral',
    icon: '⏏',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S), iv: 0.28, quantity: 2 },
      { type: 'call', direction: 'long', strike: Math.round(S * 1.08), iv: 0.30, quantity: 1 },
    ],
  },
  'Christmas Tree': {
    category: 'Neutral',
    icon: '🎄',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.10), iv: 0.27, quantity: 1 },
    ],
  },

  /* ── Additional Volatile ────────────────────────── */

  'Reverse Iron Condor': {
    category: 'Volatile',
    icon: '◇',
    legs: (S) => [
      { type: 'put', direction: 'short', strike: Math.round(S * 0.90), iv: 0.32, quantity: 1 },
      { type: 'put', direction: 'long', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'long', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.10), iv: 0.30, quantity: 1 },
    ],
  },
  'Reverse Iron Butterfly': {
    category: 'Volatile',
    icon: '⬦',
    legs: (S) => [
      { type: 'put', direction: 'short', strike: Math.round(S * 0.93), iv: 0.32, quantity: 1 },
      { type: 'put', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'long', strike: Math.round(S), iv: 0.28, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.07), iv: 0.30, quantity: 1 },
    ],
  },

  /* ── Hedging / Protective ───────────────────────── */

  'Protective Put': {
    category: 'Bullish',
    icon: '🛡',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S * 0.95), iv: 0.28, quantity: 1 },
    ],
  },
  'Collar': {
    category: 'Neutral',
    icon: '⌁',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S * 0.95), iv: 0.28, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
    ],
  },

  /* ── Volatility Bias ────────────────────────────── */

  'Strip': {
    category: 'Volatile',
    icon: '⫼',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 2 },
    ],
  },
  'Strap': {
    category: 'Volatile',
    icon: '⫿',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 2 },
      { type: 'put', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
    ],
  },
  'Gut Strangle': {
    category: 'Volatile',
    icon: '⥮',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'long', strike: Math.round(S * 1.05), iv: 0.30, quantity: 1 },
    ],
  },
  'Short Gut Strangle': {
    category: 'Neutral',
    icon: '⥯',
    legs: (S) => [
      { type: 'call', direction: 'short', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S * 1.05), iv: 0.30, quantity: 1 },
    ],
  },

  /* ── Butterfly / Condor Variants ────────────────── */

  'Short Butterfly': {
    category: 'Volatile',
    icon: '⋈',
    legs: (S) => [
      { type: 'call', direction: 'short', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'long', strike: Math.round(S), iv: 0.28, quantity: 2 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.30, quantity: 1 },
    ],
  },
  'Put Butterfly': {
    category: 'Neutral',
    icon: '🦋',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S), iv: 0.28, quantity: 2 },
      { type: 'put', direction: 'long', strike: Math.round(S * 1.05), iv: 0.30, quantity: 1 },
    ],
  },
  'Long Call Condor': {
    category: 'Neutral',
    icon: '▬',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S * 0.93), iv: 0.32, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S * 0.97), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.03), iv: 0.28, quantity: 1 },
      { type: 'call', direction: 'long', strike: Math.round(S * 1.07), iv: 0.30, quantity: 1 },
    ],
  },
  'Long Put Condor': {
    category: 'Neutral',
    icon: '▭',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S * 0.93), iv: 0.32, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S * 0.97), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S * 1.03), iv: 0.28, quantity: 1 },
      { type: 'put', direction: 'long', strike: Math.round(S * 1.07), iv: 0.30, quantity: 1 },
    ],
  },
  'Broken Wing Put Butterfly': {
    category: 'Neutral',
    icon: '⏍',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S * 1.05), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S), iv: 0.28, quantity: 2 },
      { type: 'put', direction: 'long', strike: Math.round(S * 0.92), iv: 0.30, quantity: 1 },
    ],
  },
  'Put Christmas Tree': {
    category: 'Neutral',
    icon: '🌲',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S * 0.95), iv: 0.28, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S * 0.90), iv: 0.27, quantity: 1 },
    ],
  },

  /* ── Combo / Exotic ─────────────────────────────── */

  'Big Lizard': {
    category: 'Neutral',
    icon: '🐊',
    legs: (S) => [
      { type: 'call', direction: 'short', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'long', strike: Math.round(S * 1.07), iv: 0.28, quantity: 1 },
    ],
  },
  'Box Spread': {
    category: 'Neutral',
    icon: '☐',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
      { type: 'put', direction: 'long', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
      { type: 'put', direction: 'short', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1 },
    ],
  },
  'Zebra': {
    category: 'Bullish',
    icon: '🦓',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S), iv: 0.30, quantity: 2 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1 },
    ],
  },

  /* ══════════════════════════════════════════════════════
     Multi-Expiry Strategies
     Each leg has its own `dte` (days to expiry).
     ══════════════════════════════════════════════════════ */

  'Calendar Call Spread': {
    category: 'Neutral',
    icon: '📅',
    legs: (S) => [
      { type: 'call', direction: 'short', strike: Math.round(S), iv: 0.30, quantity: 1, dte: 30 },
      { type: 'call', direction: 'long', strike: Math.round(S), iv: 0.28, quantity: 1, dte: 60 },
    ],
  },
  'Calendar Put Spread': {
    category: 'Neutral',
    icon: '📆',
    legs: (S) => [
      { type: 'put', direction: 'short', strike: Math.round(S), iv: 0.30, quantity: 1, dte: 30 },
      { type: 'put', direction: 'long', strike: Math.round(S), iv: 0.28, quantity: 1, dte: 60 },
    ],
  },
  'Diagonal Call Spread': {
    category: 'Bullish',
    icon: '⤡',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S * 0.95), iv: 0.28, quantity: 1, dte: 60 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.30, quantity: 1, dte: 30 },
    ],
  },
  'Diagonal Put Spread': {
    category: 'Bearish',
    icon: '⤢',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1, dte: 60 },
      { type: 'put', direction: 'short', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1, dte: 30 },
    ],
  },
  'Poor Man\'s Covered Call': {
    category: 'Bullish',
    icon: '💰',
    legs: (S) => [
      { type: 'call', direction: 'long', strike: Math.round(S * 0.90), iv: 0.28, quantity: 1, dte: 90 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.30, quantity: 1, dte: 30 },
    ],
  },
  'Double Calendar': {
    category: 'Neutral',
    icon: '📋',
    legs: (S) => [
      { type: 'put', direction: 'short', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1, dte: 30 },
      { type: 'put', direction: 'long', strike: Math.round(S * 0.95), iv: 0.28, quantity: 1, dte: 60 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.30, quantity: 1, dte: 30 },
      { type: 'call', direction: 'long', strike: Math.round(S * 1.05), iv: 0.28, quantity: 1, dte: 60 },
    ],
  },
  'Double Diagonal': {
    category: 'Neutral',
    icon: '⬡',
    legs: (S) => [
      { type: 'put', direction: 'long', strike: Math.round(S * 0.92), iv: 0.28, quantity: 1, dte: 60 },
      { type: 'put', direction: 'short', strike: Math.round(S * 0.95), iv: 0.30, quantity: 1, dte: 30 },
      { type: 'call', direction: 'short', strike: Math.round(S * 1.05), iv: 0.30, quantity: 1, dte: 30 },
      { type: 'call', direction: 'long', strike: Math.round(S * 1.08), iv: 0.28, quantity: 1, dte: 60 },
    ],
  },
};
