# Options Simulator

A browser-based options trading simulator with Black-Scholes pricing, multi-leg strategy builder, payoff diagrams, Greeks visualisation, and optional live market data via the Tradier API.

**[Live Demo →](https://iurdivad-netizen.github.io/shiny-enigma/)**

## Features

- **Payoff Diagrams** — Interactive P&L charts at expiry with green/red profit/loss zones, breakeven markers, and individual leg lines
- **Greeks Visualisation** — Real-time net Delta, Gamma, Theta, and Vega across your entire position
- **Multi-Leg Strategy Builder** — Add/remove/edit unlimited option legs with full parameter control
- **42 Strategy Presets** — Iron Condor, Butterfly, Straddle, Spreads, and more — click to load
- **Time Decay Slider** — See how your P&L curve evolves as expiry approaches
- **IV Shift Slider** — Model volatility crush or expansion scenarios
- **Live Options Chain** *(optional)* — Connect a free Tradier sandbox API token to browse real options chains with Greeks from ORATS. Click bid/ask to add legs with market prices.

## Quick Start

```bash
# Clone
git clone https://github.com/iurdivad-netizen/shiny-enigma.git
cd shiny-enigma

# Install
npm install

# Dev server
npm run dev

# Build for production
npm run build
```

## Live Market Data (Optional)

The simulator works fully offline with manual parameter input. To enable live options chain data:

1. Get a free sandbox API token at [developer.tradier.com](https://developer.tradier.com/)
2. Open the app and expand **Live Options Chain**
3. Paste your token and click Save (stored in `localStorage` — never leaves your browser)
4. Search for any US equity ticker to load real options chains

Data is 15-minute delayed via Tradier's sandbox. Greeks are sourced from ORATS.

## Deployment

The app deploys automatically to GitHub Pages via the included GitHub Actions workflow. Push to `main` and it builds + deploys.

To deploy manually:

```bash
npm run build
# Upload the `dist/` folder to any static host
```

## Architecture

| Layer | Technology |
|-------|-----------|
| Pricing engine | Black-Scholes-Merton (analytical, zero dependencies) |
| Greeks | Analytical Delta, Gamma, Theta, Vega |
| Frontend | React 18 + Vite |
| Charts | Recharts |
| Styling | Tailwind CSS (CDN) |
| Icons | Lucide React |
| Market data | Tradier Sandbox API (CORS-enabled, browser-direct) |

## License

MIT
