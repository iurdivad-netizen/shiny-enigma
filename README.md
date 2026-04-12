# Options Simulator

A browser-based options trading simulator with Black-Scholes pricing, multi-leg strategy builder, payoff diagrams, and Greeks visualisation.

**[Live Demo →](https://iurdivad-netizen.github.io/shiny-enigma/)**

## Features

- **Payoff Diagrams** — Interactive P&L charts at expiry with green/red profit/loss zones, breakeven markers, and individual leg lines
- **Greeks Visualisation** — Real-time net Delta, Gamma, Theta, and Vega across your entire position
- **Multi-Leg Strategy Builder** — Add/remove/edit unlimited option legs with full parameter control
- **49 Strategy Presets** — Iron Condor, Butterfly, Straddle, Calendar & Diagonal Spreads, and more — click to load
- **Per-Leg Expiration** — Each leg can have its own DTE for calendar/diagonal strategies
- **Time Decay Slider** — See how your P&L curve evolves as expiry approaches
- **IV Shift Slider** — Model volatility crush or expansion scenarios

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

## License

MIT
