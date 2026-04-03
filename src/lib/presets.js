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
};
