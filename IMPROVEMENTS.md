# Improvement Ideas for Options Simulator

A prioritized list of improvements organized by category. Each item includes the rationale and estimated complexity.

---

## 1. Code Quality & Developer Experience

### 1.1 Add a Test Suite
**Priority: High** | **Complexity: Medium**

The project has zero tests. The pure-math pricing engine (`blackScholes.js`) and portfolio logic (`portfolio.js`) are ideal candidates for unit testing since they have no UI dependencies.

- Add **Vitest** (already Vite-based, zero-config) with tests for:
  - `bsmPrice` — known analytical values (e.g., at-the-money, deep ITM/OTM, edge cases like t=0)
  - `bsmGreeks` — delta ≈ 0.5 for ATM calls, gamma symmetry, put-call parity for theta
  - `legPnlAtExpiry` / `legPnlAtTime` — long vs short, call vs put, multi-contract
  - `portfolio.js` — trade creation, P&L calculations, Sharpe ratio, max drawdown
  - `backtestEngine.js` — strategy runners against mock price data
- Add **React Testing Library** for key UI flows (loading a preset, adding/removing legs)
- Wire tests into the GitHub Actions workflow so CI catches regressions

### 1.2 Configure ESLint and Prettier
**Priority: Medium** | **Complexity: Low**

There's no linting or formatting enforcement. Three `eslint-disable-next-line` comments in `App.jsx` (lines 84, 125, 162) suppress `react-hooks/exhaustive-deps` without addressing root causes.

- Add ESLint with the `eslint-plugin-react-hooks` rules enabled
- Fix the suppressed dependency warnings by restructuring the `useMemo` calls or explicitly documenting why certain deps are intentionally omitted
- Add Prettier for consistent formatting
- Add a `lint` script to `package.json` and enforce it in CI

### 1.3 Refactor Large Components
**Priority: Medium** | **Complexity: Medium**

Several files are oversized and handle multiple concerns:

| File | Lines | Suggestion |
|------|-------|------------|
| `App.jsx` | 878 | Extract the chart section into a `PayoffChart` component; extract the leg editor table into a `LegEditor` component; extract the parameter header into a `ParameterBar` component |
| `HistoricalData.jsx` | 819 | Split API logic into a custom hook (`useHistoricalData`); separate the chart and the controls into sub-components |
| `BacktestPanel.jsx` | 748 | `ManualBacktest` and `AutoBacktest` are already separate functions — move them to their own files |

### 1.4 Install Tailwind via npm Instead of CDN
**Priority: Low** | **Complexity: Low**

Tailwind is currently loaded via CDN in `index.html`. Installing it as a proper dependency enables:
- Tree-shaking (production CSS drops from ~300KB to ~10-20KB)
- Tailwind IntelliSense in editors
- Custom theme configuration via `tailwind.config.js`
- JIT mode for arbitrary values

---

## 2. User Experience & Features

### 2.1 Strategy Comparison Mode
**Priority: High** | **Complexity: Medium**

Allow users to overlay two or more strategies on the same payoff chart for side-by-side comparison. Currently, loading a new preset replaces the existing legs entirely. A "compare" toggle could snapshot the current P&L curve before loading a new strategy.

### 2.2 Export and Import Strategies
**Priority: High** | **Complexity: Low**

Users currently lose custom multi-leg setups when they refresh or load a preset. Add:
- **Export to JSON** — serialize current legs + parameters into a downloadable file
- **Import from JSON** — load a previously saved strategy
- **URL-based sharing** — encode the strategy into a shareable URL hash (e.g., `#strategy=base64...`)

### 2.3 Probability of Profit (PoP) Display
**Priority: High** | **Complexity: Low**

The Black-Scholes engine already has `normalCDF`. Use it to calculate and display:
- Probability of the strategy being profitable at expiry
- Probability of reaching max profit
- Expected value of the trade

This is a high-value feature with low implementation effort since the math is already in place.

### 2.4 Implied Volatility Smile / Surface Visualization
**Priority: Medium** | **Complexity: Medium**

Plot the IV smile (IV vs strike) and optionally an IV surface (IV vs strike vs expiration) from the historical options chain data. This would help users visualize skew and term structure.

### 2.5 Greeks Over Price Range Charts
**Priority: Medium** | **Complexity: Low**

Currently, net Greeks are shown as single aggregate numbers. Add a "Greeks" tab to the chart area that plots Delta, Gamma, Theta, and Vega as curves across the underlying price range, similar to the payoff diagram. The calculation logic already exists in `legGreeks`.

### 2.6 Mobile-Responsive Layout
**Priority: Medium** | **Complexity: Medium**

The current layout uses a fixed two-column grid that doesn't adapt well to narrow screens. Key improvements:
- Stack the chart above the leg editor on small screens
- Make the preset grid scrollable horizontally on mobile
- Collapse parameter inputs into an expandable panel on mobile
- Ensure touch targets (sliders, buttons) are large enough for finger input

### 2.7 Undo / Redo
**Priority: Low** | **Complexity: Medium**

Add undo/redo for leg modifications and preset loads. A simple state history stack (last N states of the `legs` array) would make the app more forgiving when experimenting.

---

## 3. Performance

### 3.1 Lazy-Load Optional Panels
**Priority: Medium** | **Complexity: Low**

The Historical Data, Backtest, Forward Test, and Portfolio panels are all imported eagerly even if the user never opens them. Use `React.lazy()` + `Suspense` to code-split these:

```jsx
const HistoricalData = React.lazy(() => import('./components/HistoricalData.jsx'));
const BacktestPanel = React.lazy(() => import('./components/BacktestPanel.jsx'));
```

This would reduce the initial bundle size by roughly 30-40%.

### 3.2 Memoize Expensive Chart Computations
**Priority: Low** | **Complexity: Low**

The `ChartTooltip` component is defined inline inside `App.jsx` (line 274), causing it to be recreated on every render. Move it outside the component or wrap it in `useMemo`. Similarly, ensure `filteredPresets` (line 269) doesn't trigger unnecessary re-renders.

### 3.3 Web Worker for Backtesting
**Priority: Low** | **Complexity: Medium**

The automated backtest runner iterates over potentially thousands of historical data points and runs BSM pricing at each step. Moving this computation to a Web Worker would prevent UI freezing during large backtests.

---

## 4. Reliability & Error Handling

### 4.1 API Retry Logic with Exponential Backoff
**Priority: Medium** | **Complexity: Low**

`alphaVantageApi.js` makes HTTP calls without retry logic. Add a shared `fetchWithRetry` utility that:
- Retries on network errors and 5xx responses
- Uses exponential backoff (1s, 2s, 4s)
- Surfaces clear error messages to the user
- Supports AbortController for cancellation

### 4.2 Input Validation
**Priority: Medium** | **Complexity: Low**

Several numeric inputs lack bounds checking:
- Negative strike prices are accepted
- IV can be set to 0 or negative (causes `NaN` in BSM when combined with t=0)
- Quantity of 0 contracts is allowed but produces invisible legs
- DTE can be negative

Add validation guards in `updateLeg` and the parameter inputs, with visual feedback (red borders, tooltips) for invalid values.

### 4.3 Graceful Degradation for localStorage
**Priority: Low** | **Complexity: Low**

The portfolio system silently fails if localStorage is unavailable (private browsing, storage full). Show a one-time banner warning the user that their data won't persist, and consider an in-memory fallback.

---

## 5. Accessibility

### 5.1 ARIA Labels and Keyboard Navigation
**Priority: Medium** | **Complexity: Medium**

The app lacks ARIA attributes on interactive elements. Key improvements:
- Add `aria-label` to icon-only buttons (Reset, Add Leg, Remove Leg, toggle visibility)
- Add `aria-expanded` to collapsible section headers
- Ensure all form inputs have associated `<label>` elements (some use implicit wrapping, which is fragile)
- Add keyboard handlers for the preset grid (currently click-only)
- Add `role="tablist"` / `role="tab"` to the Simulation/Backtest/Portfolio tab switcher

### 5.2 Color Contrast
**Priority: Low** | **Complexity: Low**

Several text elements use `text-slate-500` on the dark background, which may not meet WCAG AA contrast ratios. Audit and adjust the palette so all text achieves at least 4.5:1 contrast.

---

## 6. Advanced Features (Longer Term)

### 6.1 Position Sizing / Risk Calculator
Add a calculator that, given an account size and max risk percentage, recommends the number of contracts. This would use the `maxLoss` value already computed in `pnlExtremes`.

### 6.2 Greeks Heatmap
A 2D heatmap showing P&L or a selected Greek across two axes (e.g., underlying price vs IV, or underlying price vs time to expiry). This is a natural extension of the existing payoff diagram.

### 6.3 Monte Carlo Simulation
Simulate thousands of random price paths using geometric Brownian motion to estimate strategy outcomes probabilistically. Display as a fan chart or histogram of terminal P&L values.

### 6.4 Multi-Underlying Support
Currently the simulator assumes a single underlying. Supporting multiple underlyings would enable correlation-based strategies (e.g., pairs trades, dispersion).

---

## Summary — Quick Wins vs. Strategic Investments

### Quick wins (low effort, high impact)
1. Probability of Profit display (2.3)
2. Export/Import strategies (2.2)
3. Input validation (4.2)
4. Lazy-load optional panels (3.1)
5. ESLint + Prettier setup (1.2)

### Strategic investments (higher effort, transformative)
1. Test suite (1.1)
2. Strategy comparison mode (2.1)
3. Component refactoring (1.3)
4. Greeks charts (2.5)
5. IV surface visualization (2.4)
