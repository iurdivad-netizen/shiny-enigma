import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Plus, Trash2, Eye, EyeOff, RotateCcw, ChevronDown, ChevronUp,
  Layers, Database, Clock, Briefcase, FlaskConical, PlayCircle,
} from 'lucide-react';
import {
  bsmPrice, legPnlAtExpiry, legPnlAtTime, legGreeks,
} from './lib/blackScholes.js';
import { LEG_COLORS, CATEGORIES, CAT_COLORS, PRESETS } from './lib/presets.js';
import { loadPortfolios, savePortfolios, deletePortfolio } from './lib/portfolio.js';
import OptionsChain from './components/OptionsChain.jsx';
import HistoricalData from './components/HistoricalData.jsx';
import PortfolioTracker from './components/PortfolioTracker.jsx';
import BacktestPanel from './components/BacktestPanel.jsx';
import ForwardTestPanel from './components/ForwardTestPanel.jsx';

let nextId = 1;
const makeId = () => `leg-${nextId++}`;
const fmtNum = (n, d = 2) => (Math.abs(n) < 0.005 ? '0.00' : n.toFixed(d));

export default function App() {
  /* ── State ────────────────────────────────────────────── */
  const [underlyingPrice, setUnderlyingPrice] = useState(100);
  const [riskFreeRate, setRiskFreeRate] = useState(0.05);
  const [daysToExpiry, setDaysToExpiry] = useState(30);
  const [dividendYield, setDividendYield] = useState(0);
  const [legs, setLegs] = useState([]);
  const [timePercent, setTimePercent] = useState(100);
  const [ivShift, setIvShift] = useState(0);
  const [showLegLines, setShowLegLines] = useState(true);
  const [activePreset, setActivePreset] = useState(null);
  const [expandPresets, setExpandPresets] = useState(true);
  const [expandChain, setExpandChain] = useState(true);
  const [expandHistory, setExpandHistory] = useState(false);
  const [filterCat, setFilterCat] = useState(null);
  const [tickerLabel, setTickerLabel] = useState('');
  const [expandPortfolio, setExpandPortfolio] = useState(false);
  const [expandBacktest, setExpandBacktest] = useState(false);
  const [expandForward, setExpandForward] = useState(false);
  const [portfolios, setPortfolios] = useState(() => loadPortfolios());
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);

  /* ── Portfolio persistence ───────────────────────────── */
  useEffect(() => {
    savePortfolios(portfolios);
  }, [portfolios]);

  const handleDeletePortfolio = useCallback((id) => {
    setPortfolios((prev) => deletePortfolio(prev, id));
    if (selectedPortfolioId === id) setSelectedPortfolioId(null);
  }, [selectedPortfolioId]);

  const handleBacktestResult = useCallback((portfolio) => {
    setPortfolios((prev) => [...prev, portfolio]);
    setSelectedPortfolioId(portfolio.id);
  }, []);

  /** Per-leg time helpers — each leg can have its own DTE. */
  const legDte = (leg) => leg.dte ?? daysToExpiry;
  const legT = (leg) => legDte(leg) / 365;
  const legViewT = (leg) => (legDte(leg) * timePercent) / 100 / 365;

  /* ── Auto-calculate premiums via BSM ──────────────────── */
  const legsWithPremiums = useMemo(() => {
    return legs.map((leg) => {
      if (leg.premiumOverride) return leg;
      const t = legT(leg);
      const prices = bsmPrice(
        underlyingPrice, leg.strike, t, riskFreeRate,
        leg.iv + ivShift / 100, dividendYield
      );
      const premium = leg.type === 'call' ? prices.call : prices.put;
      return { ...leg, premium: Math.round(premium * 100) / 100 };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs, underlyingPrice, daysToExpiry, riskFreeRate, dividendYield, ivShift]);

  /* ── Chart data ───────────────────────────────────────── */
  const chartData = useMemo(() => {
    if (legsWithPremiums.length === 0) return [];
    const strikes = legsWithPremiums.map((l) => l.strike);
    const minStrike = Math.min(...strikes);
    const maxStrike = Math.max(...strikes);
    const range = Math.max(maxStrike - minStrike, underlyingPrice * 0.1);
    const lo = Math.max(0, Math.min(minStrike, underlyingPrice) - range * 1.2);
    const hi = Math.max(maxStrike, underlyingPrice) + range * 1.2;
    const step = (hi - lo) / 250;
    const pts = [];

    for (let price = lo; price <= hi; price += step) {
      const pt = { price: Math.round(price * 100) / 100 };
      let combinedExpiry = 0;
      let combinedCurrent = 0;

      legsWithPremiums.forEach((leg, i) => {
        const pnl = legPnlAtExpiry(leg, price);
        combinedExpiry += pnl;
        if (leg.visible !== false) pt[`leg${i}`] = Math.round(pnl);

        if (timePercent < 100) {
          const adjIv = leg.iv + ivShift / 100;
          const vt = legViewT(leg);
          combinedCurrent += legPnlAtTime(
            { ...leg, iv: adjIv }, price, vt, riskFreeRate, dividendYield
          );
        }
      });

      pt.combined = Math.round(combinedExpiry);
      pt.profit = Math.max(0, pt.combined);
      pt.loss = Math.min(0, pt.combined);
      if (timePercent < 100) pt.timePnl = Math.round(combinedCurrent);
      pts.push(pt);
    }
    return pts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legsWithPremiums, underlyingPrice, timePercent, daysToExpiry, riskFreeRate, dividendYield, ivShift]);

  /* ── Breakevens ───────────────────────────────────────── */
  const breakevens = useMemo(() => {
    const bks = [];
    for (let i = 1; i < chartData.length; i++) {
      const prev = chartData[i - 1].combined;
      const curr = chartData[i].combined;
      if ((prev <= 0 && curr >= 0) || (prev >= 0 && curr <= 0)) {
        const ratio = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
        bks.push(
          Math.round(
            (chartData[i - 1].price + ratio * (chartData[i].price - chartData[i - 1].price)) * 100
          ) / 100
        );
      }
    }
    return bks;
  }, [chartData]);

  /* ── Net Greeks ───────────────────────────────────────── */
  const netGreeks = useMemo(() => {
    const net = { delta: 0, gamma: 0, theta: 0, vega: 0 };
    legsWithPremiums.forEach((leg) => {
      const vt = legViewT(leg);
      const t = legT(leg);
      const g = legGreeks(
        { ...leg, iv: leg.iv + ivShift / 100 },
        underlyingPrice, vt > 0 ? vt : t, riskFreeRate, dividendYield
      );
      net.delta += g.delta;
      net.gamma += g.gamma;
      net.theta += g.theta;
      net.vega += g.vega;
    });
    return net;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legsWithPremiums, underlyingPrice, timePercent, daysToExpiry, riskFreeRate, dividendYield, ivShift]);

  /* ── P&L extremes + cost ──────────────────────────────── */
  const pnlExtremes = useMemo(() => {
    if (!chartData.length) return { maxProfit: 0, maxLoss: 0 };
    const vals = chartData.map((d) => d.combined);
    return { maxProfit: Math.max(...vals), maxLoss: Math.min(...vals) };
  }, [chartData]);

  const netCost = useMemo(() => {
    return legsWithPremiums.reduce((sum, leg) => {
      return sum + (leg.direction === 'long' ? -1 : 1) * leg.premium * leg.quantity * 100;
    }, 0);
  }, [legsWithPremiums]);

  /* ── Actions ──────────────────────────────────────────── */
  const loadPreset = useCallback(
    (name) => {
      const preset = PRESETS[name];
      if (!preset) return;
      setLegs(
        preset.legs(underlyingPrice).map((l) => ({
          ...l, id: makeId(), visible: true, premiumOverride: false, premium: 0,
        }))
      );
      setActivePreset(name);
      setTimePercent(100);
      setIvShift(0);
      // If any leg in the preset has a dte, keep global at max dte for sensible slider range
      const presetLegs = preset.legs(underlyingPrice);
      const maxDte = Math.max(...presetLegs.map((l) => l.dte ?? daysToExpiry));
      if (presetLegs.some((l) => l.dte != null)) setDaysToExpiry(maxDte);
    },
    [underlyingPrice, daysToExpiry]
  );

  const addLeg = useCallback(() => {
    setLegs((prev) => [
      ...prev,
      {
        id: makeId(), type: 'call', direction: 'long',
        strike: Math.round(underlyingPrice), iv: 0.3, quantity: 1,
        premium: 0, visible: true, premiumOverride: false,
      },
    ]);
    setActivePreset(null);
  }, [underlyingPrice]);

  /** Add a leg from the options chain (pre-populated with market data). */
  const addLegFromChain = useCallback((legData) => {
    setLegs((prev) => [
      ...prev,
      { ...legData, id: makeId(), visible: true },
    ]);
    setActivePreset(null);
  }, []);

  const updateLeg = useCallback((id, field, value) => {
    setLegs((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const u = { ...l, [field]: value };
        if (field === 'premium') u.premiumOverride = true;
        return u;
      })
    );
    setActivePreset(null);
  }, []);

  const removeLeg = useCallback((id) => {
    setLegs((prev) => prev.filter((l) => l.id !== id));
    setActivePreset(null);
  }, []);

  const toggleLeg = useCallback((id) => {
    setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  }, []);

  const resetAll = useCallback(() => {
    setLegs([]);
    setActivePreset(null);
    setTimePercent(100);
    setIvShift(0);
  }, []);

  /** Callback from OptionsChain when a quote is loaded. */
  const handleQuoteLoaded = useCallback((q) => {
    setUnderlyingPrice(q.last);
    setTickerLabel(`${q.symbol} — ${q.description}`);
  }, []);

  const handleDteLoaded = useCallback((dte) => {
    setDaysToExpiry(dte);
  }, []);

  /** Callback from HistoricalData when a date is clicked on the chart. */
  const handleHistoricalQuote = useCallback((q) => {
    setUnderlyingPrice(q.close);
    setTickerLabel(`${q.symbol} — Historical (${q.date})`);
  }, []);

  const filteredPresets = Object.entries(PRESETS).filter(
    ([, v]) => !filterCat || v.category === filterCat
  );

  /* ── Custom tooltip ───────────────────────────────────── */
  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const combined = payload.find((p) => p.dataKey === 'combined');
    const timePnl = payload.find((p) => p.dataKey === 'timePnl');
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-xs shadow-lg">
        <div className="font-mono text-slate-400 mb-1">
          Price: ${typeof label === 'number' ? label.toFixed(2) : label}
        </div>
        {combined && (
          <div className={`font-mono font-semibold ${combined.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            Expiry P&L: ${combined.value?.toLocaleString()}
          </div>
        )}
        {timePnl && (
          <div className={`font-mono mt-0.5 ${timePnl.value >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {timePercent}% DTE P&L: ${timePnl.value?.toLocaleString()}
          </div>
        )}
      </div>
    );
  };

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="px-5 py-3 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <Layers size={20} className="text-blue-500" />
          <span className="text-base font-bold tracking-tight">Options Simulator</span>
          <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">BSM</span>
          {tickerLabel && (
            <span className="text-xs text-slate-400 ml-2 hidden sm:inline">{tickerLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Spot $
            <input
              type="number" value={underlyingPrice}
              onChange={(e) => setUnderlyingPrice(+e.target.value || 0)}
              className="w-20 text-right font-semibold text-sm" step="1"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            DTE
            <input
              type="number" value={daysToExpiry}
              onChange={(e) => setDaysToExpiry(Math.max(0, +e.target.value || 0))}
              className="w-14 text-right" step="1"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Rate%
            <input
              type="number" value={(riskFreeRate * 100).toFixed(1)}
              onChange={(e) => setRiskFreeRate((+e.target.value || 0) / 100)}
              className="w-12 text-right" step="0.5"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Div%
            <input
              type="number" value={(dividendYield * 100).toFixed(1)}
              onChange={(e) => setDividendYield((+e.target.value || 0) / 100)}
              className="w-12 text-right" step="0.5"
            />
          </label>
          <button
            onClick={resetAll}
            className="flex items-center gap-1 px-2.5 py-1 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 rounded text-xs"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </header>

      <div className="px-5 pb-6 max-w-[1280px] mx-auto">
        {/* ── Market Data / Options Chain ──────────────────── */}
        <div>
          <button
            onClick={() => setExpandChain(!expandChain)}
            className="flex items-center gap-1.5 mt-4 mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200"
          >
            <Database size={13} />
            Live Options Chain
            {expandChain ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expandChain && (
            <OptionsChain
              onAddLeg={addLegFromChain}
              onQuoteLoaded={handleQuoteLoaded}
              onDteLoaded={handleDteLoaded}
            />
          )}
        </div>

        {/* ── Historical Data ─────────────────────────────── */}
        <div>
          <button
            onClick={() => setExpandHistory(!expandHistory)}
            className="flex items-center gap-1.5 mt-4 mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200"
          >
            <Clock size={13} />
            Historical Data
            {expandHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expandHistory && (
            <HistoricalData
              onAddLeg={addLegFromChain}
              onHistoricalQuote={handleHistoricalQuote}
            />
          )}
        </div>

        {/* ── Backtesting ──────────────────────────────────── */}
        <div>
          <button
            onClick={() => setExpandBacktest(!expandBacktest)}
            className="flex items-center gap-1.5 mt-4 mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200"
          >
            <FlaskConical size={13} />
            Backtesting
            {expandBacktest ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expandBacktest && (
            <div className="fade-in">
              <BacktestPanel
                onResult={handleBacktestResult}
                currentLegs={legsWithPremiums}
                underlyingPrice={underlyingPrice}
              />
            </div>
          )}
        </div>

        {/* ── Forward Testing (Paper Trading) ────────────── */}
        <div>
          <button
            onClick={() => setExpandForward(!expandForward)}
            className="flex items-center gap-1.5 mt-4 mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200"
          >
            <PlayCircle size={13} />
            Forward Testing
            {expandForward ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expandForward && (
            <div className="fade-in">
              <ForwardTestPanel
                portfolios={portfolios}
                setPortfolios={setPortfolios}
                underlyingPrice={underlyingPrice}
                symbol={tickerLabel.split(' ')[0] || ''}
              />
            </div>
          )}
        </div>

        {/* ── Portfolio Tracker ───────────────────────────── */}
        <div>
          <button
            onClick={() => setExpandPortfolio(!expandPortfolio)}
            className="flex items-center gap-1.5 mt-4 mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200"
          >
            <Briefcase size={13} />
            Portfolio Tracker
            {portfolios.length > 0 && (
              <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded-full text-slate-400 normal-case">
                {portfolios.length}
              </span>
            )}
            {expandPortfolio ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expandPortfolio && (
            <div className="fade-in">
              <PortfolioTracker
                portfolios={portfolios}
                onDelete={handleDeletePortfolio}
                onSelect={setSelectedPortfolioId}
                selectedId={selectedPortfolioId}
              />
            </div>
          )}
        </div>

        {/* ── Strategy Presets ─────────────────────────────── */}
        <div className="mt-4">
          <button
            onClick={() => setExpandPresets(!expandPresets)}
            className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200"
          >
            Strategy Presets
            {expandPresets ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expandPresets && (
            <div className="fade-in">
              <div className="flex gap-1.5 mb-2.5">
                <button
                  onClick={() => setFilterCat(null)}
                  className={`px-2.5 py-1 text-[11px] rounded-full border ${
                    !filterCat
                      ? 'bg-slate-700 text-slate-200 border-slate-600'
                      : 'border-slate-700 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCat(filterCat === cat ? null : cat)}
                    className="px-2.5 py-1 text-[11px] rounded-full border"
                    style={{
                      background: filterCat === cat ? '#334155' : 'transparent',
                      color: filterCat === cat ? CAT_COLORS[cat] : '#64748b',
                      borderColor: filterCat === cat ? CAT_COLORS[cat] + '44' : '#334155',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {filteredPresets.map(([name, preset]) => (
                  <button
                    key={name}
                    onClick={() => loadPreset(name)}
                    className="px-3 py-1.5 text-xs rounded-md"
                    style={{
                      border: `1px solid ${activePreset === name ? CAT_COLORS[preset.category] : '#334155'}`,
                      background: activePreset === name ? CAT_COLORS[preset.category] + '15' : '#1e293b',
                      color: activePreset === name ? CAT_COLORS[preset.category] : '#cbd5e1',
                    }}
                  >
                    <span className="mr-1">{preset.icon}</span>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Payoff Chart ────────────────────────────────── */}
        <div className="mt-5 bg-[#111827] rounded-lg border border-slate-800 p-4 pb-2">
          {chartData.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-slate-600 text-sm">
              Select a strategy or add legs to see the payoff diagram
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gLoss" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="price" type="number" domain={['dataMin', 'dataMax']}
                  tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `$${v}`}
                  tickCount={10} stroke="#334155"
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(v) => `$${v}`} stroke="#334155"
                />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                <ReferenceLine
                  x={underlyingPrice} stroke="#3b82f6" strokeDasharray="6 4" strokeWidth={1}
                  label={{ value: `Spot $${underlyingPrice}`, position: 'top', fill: '#3b82f6', fontSize: 11 }}
                />
                {breakevens.map((be, i) => (
                  <ReferenceLine
                    key={i} x={be} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1}
                    label={{ value: `BE $${be}`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }}
                  />
                ))}
                <Area dataKey="profit" fill="url(#gProfit)" stroke="none" isAnimationActive={false} />
                <Area dataKey="loss" fill="url(#gLoss)" stroke="none" isAnimationActive={false} />
                {showLegLines &&
                  legsWithPremiums.map(
                    (leg, i) =>
                      leg.visible !== false && (
                        <Line
                          key={leg.id} dataKey={`leg${i}`}
                          stroke={LEG_COLORS[i % LEG_COLORS.length]}
                          strokeWidth={1} strokeDasharray="4 3" dot={false}
                          isAnimationActive={false}
                          name={`${leg.direction === 'long' ? 'L' : 'S'} ${leg.strike} ${leg.type[0].toUpperCase()}`}
                        />
                      )
                  )}
                {timePercent < 100 && (
                  <Line
                    dataKey="timePnl" stroke="#818cf8" strokeWidth={2}
                    strokeDasharray="6 3" dot={false} isAnimationActive={false}
                    name={`P&L at ${timePercent}% DTE`}
                  />
                )}
                <Line
                  dataKey="combined" stroke="#f1f5f9" strokeWidth={2.5}
                  dot={false} isAnimationActive={false} name="P&L at Expiry"
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Time / IV Sliders ────────────────────────────── */}
        {legsWithPremiums.length > 0 && (
          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-4 fade-in">
            <div className="bg-[#111827] rounded-md border border-slate-800 p-3">
              <div className="flex justify-between mb-1.5 text-xs">
                <span className="text-slate-400">Time to Expiry</span>
                <span className="font-mono font-semibold text-indigo-400">
                  {timePercent}%{' '}
                  <span className="text-slate-500 font-normal">
                    ({legsWithPremiums.map((l) => `${Math.round(legDte(l) * timePercent / 100)}d`).join(' / ')})
                  </span>
                </span>
              </div>
              <input
                type="range" min={0} max={100} value={timePercent}
                onChange={(e) => setTimePercent(+e.target.value)}
              />
            </div>
            <div className="bg-[#111827] rounded-md border border-slate-800 p-3">
              <div className="flex justify-between mb-1.5 text-xs">
                <span className="text-slate-400">IV Shift</span>
                <span className={`font-mono font-semibold ${
                  ivShift > 0 ? 'text-green-400' : ivShift < 0 ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {ivShift > 0 ? '+' : ''}{ivShift}%
                </span>
              </div>
              <input
                type="range" min={-30} max={30} value={ivShift}
                onChange={(e) => setIvShift(+e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ── Greeks + Key Metrics ─────────────────────────── */}
        {legsWithPremiums.length > 0 && (
          <div className="mt-3.5 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 fade-in">
            {[
              { label: 'Net Delta', value: netGreeks.delta, sym: 'Δ', color: '#60a5fa' },
              { label: 'Net Gamma', value: netGreeks.gamma, sym: 'Γ', color: '#a78bfa' },
              { label: 'Net Theta', value: netGreeks.theta, sym: 'Θ', color: '#f472b6', suf: '/day' },
              { label: 'Net Vega', value: netGreeks.vega, sym: 'ν', color: '#34d399', suf: '/1%' },
              { label: 'Max Profit', value: pnlExtremes.maxProfit, sym: '↑', color: '#4ade80', pre: '$' },
              { label: 'Max Loss', value: pnlExtremes.maxLoss, sym: '↓', color: '#f87171', pre: '$' },
              { label: netCost >= 0 ? 'Net Credit' : 'Net Debit', value: Math.abs(netCost), sym: '$', color: netCost >= 0 ? '#4ade80' : '#f87171', pre: '$' },
            ].map((c) => (
              <div key={c.label} className="bg-[#111827] rounded-md border border-slate-800 px-3 py-2.5">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{c.label}</div>
                <div className="font-mono text-base font-semibold" style={{ color: c.color }}>
                  <span className="text-[11px] opacity-70 mr-0.5">{c.sym}</span>
                  {c.pre || ''}{fmtNum(c.value)}{c.suf || ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Breakevens ──────────────────────────────────── */}
        {breakevens.length > 0 && (
          <div className="mt-2.5 flex gap-2 items-center flex-wrap fade-in">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Breakevens:</span>
            {breakevens.map((be, i) => (
              <span key={i} className="font-mono text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                ${be}
              </span>
            ))}
          </div>
        )}

        {/* ── Legs Table ──────────────────────────────────── */}
        <div className="mt-5">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Option Legs ({legsWithPremiums.length})
            </span>
            <div className="flex gap-2">
              {legsWithPremiums.length > 0 && (
                <button
                  onClick={() => setShowLegLines(!showLegLines)}
                  className="flex items-center gap-1 px-2.5 py-1 border border-slate-700 text-slate-400 hover:text-slate-200 rounded text-[11px]"
                >
                  {showLegLines ? <Eye size={12} /> : <EyeOff size={12} />} Leg Lines
                </button>
              )}
              <button
                onClick={addLeg}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
              >
                <Plus size={14} /> Add Leg
              </button>
            </div>
          </div>

          {legsWithPremiums.length > 0 && (
            <div className="bg-[#111827] rounded-lg border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {['', 'Type', 'Side', 'Strike', 'IV %', 'DTE', 'Qty', 'Premium', 'Δ', 'Γ', 'Θ', 'ν', ''].map((h, i) => (
                        <th
                          key={i}
                          className="px-2.5 py-2 text-left text-[10px] text-slate-500 uppercase tracking-wider font-semibold whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {legsWithPremiums.map((leg, i) => {
                      const vt = legViewT(leg);
                      const lt = legT(leg);
                      const g = legGreeks(
                        { ...leg, iv: leg.iv + ivShift / 100 },
                        underlyingPrice, vt > 0 ? vt : lt, riskFreeRate, dividendYield
                      );
                      return (
                        <tr key={leg.id} className="border-b border-slate-800/20 fade-in">
                          <td className="px-2.5 py-1.5">
                            <div
                              className="w-2.5 h-2.5 rounded-sm"
                              style={{ background: LEG_COLORS[i % LEG_COLORS.length] }}
                            />
                          </td>
                          <td className="px-1.5 py-1.5">
                            <select value={leg.type} onChange={(e) => updateLeg(leg.id, 'type', e.target.value)} className="w-[70px]">
                              <option value="call">Call</option>
                              <option value="put">Put</option>
                            </select>
                          </td>
                          <td className="px-1.5 py-1.5">
                            <select
                              value={leg.direction}
                              onChange={(e) => updateLeg(leg.id, 'direction', e.target.value)}
                              className="w-[72px]"
                              style={{ color: leg.direction === 'long' ? '#4ade80' : '#f87171' }}
                            >
                              <option value="long">Long</option>
                              <option value="short">Short</option>
                            </select>
                          </td>
                          <td className="px-1.5 py-1.5">
                            <input
                              type="number" value={leg.strike}
                              onChange={(e) => updateLeg(leg.id, 'strike', +e.target.value || 0)}
                              className="w-[70px] text-right" step="1"
                            />
                          </td>
                          <td className="px-1.5 py-1.5">
                            <input
                              type="number" value={(leg.iv * 100).toFixed(0)}
                              onChange={(e) => updateLeg(leg.id, 'iv', (+e.target.value || 0) / 100)}
                              className="w-[52px] text-right" step="1"
                            />
                          </td>
                          <td className="px-1.5 py-1.5">
                            <input
                              type="number" value={legDte(leg)}
                              onChange={(e) => updateLeg(leg.id, 'dte', Math.max(0, +e.target.value || 0))}
                              className="w-[52px] text-right" step="1" min="0"
                            />
                          </td>
                          <td className="px-1.5 py-1.5">
                            <input
                              type="number" value={leg.quantity}
                              onChange={(e) => updateLeg(leg.id, 'quantity', Math.max(1, +e.target.value || 1))}
                              className="w-[44px] text-right" step="1" min="1"
                            />
                          </td>
                          <td className="px-2.5 py-1.5">
                            <span className={`font-mono text-xs ${leg.premiumOverride ? 'text-slate-200' : 'text-slate-500'}`}>
                              ${leg.premium.toFixed(2)}
                            </span>
                            {leg.source === 'tradier' && (
                              <span className="ml-1 text-[9px] text-blue-400/60">MKT</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-[11px] text-blue-400">{fmtNum(g.delta)}</td>
                          <td className="px-2 py-1.5 font-mono text-[11px] text-purple-400">{fmtNum(g.gamma, 4)}</td>
                          <td className="px-2 py-1.5 font-mono text-[11px] text-pink-400">{fmtNum(g.theta)}</td>
                          <td className="px-2 py-1.5 font-mono text-[11px] text-emerald-400">{fmtNum(g.vega)}</td>
                          <td className="px-2 py-1.5">
                            <div className="flex gap-1">
                              <button
                                onClick={() => toggleLeg(leg.id)}
                                className="p-0.5 text-slate-500 hover:text-slate-300"
                              >
                                {leg.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                              <button
                                onClick={() => removeLeg(leg.id)}
                                className="p-0.5 text-red-500/70 hover:text-red-400"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <footer className="mt-6 pt-3 border-t border-slate-800 text-[11px] text-slate-600 flex flex-wrap justify-between gap-2">
          <span>Black-Scholes-Merton · European options · No transaction costs</span>
          <span>Tradier Sandbox · Alpha Vantage · 15-min delayed data</span>
        </footer>
      </div>
    </div>
  );
}
