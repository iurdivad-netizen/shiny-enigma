import { useState, useCallback, useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { Play, MousePointerClick, Zap, Plus, Download, Inbox } from 'lucide-react';
import { STRATEGY_NAMES, runBacktest, runManualBacktest } from '../lib/backtestEngine.js';
import { fetchDailyHistory, fetchDailyHistoryWithVix, getStoredAvKey } from '../lib/alphaVantageApi.js';
import { bsmPrice } from '../lib/blackScholes.js';
import Button from './ui/Button.jsx';
import StatCard from './ui/StatCard.jsx';
import ErrorBox from './ui/ErrorBox.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ConfirmButton from './ui/ConfirmButton.jsx';
import { formatCurrency } from '../lib/format.js';
import { useToast } from './ui/Toast.jsx';

export default function BacktestPanel({ onResult, onUpdate, currentLegs, underlyingPrice, sharedPriceData, backtestPortfolios }) {
  const [mode, setMode] = useState('manual'); // 'manual' | 'auto'

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-1 mb-1" role="tablist" aria-label="Backtest mode">
        <button
          role="tab"
          aria-selected={mode === 'manual'}
          onClick={() => setMode('manual')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
            mode === 'manual'
              ? 'bg-blue-600/20 border-blue-500 text-blue-400'
              : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
          }`}
        >
          <MousePointerClick size={13} /> Manual Backtest
        </button>
        <button
          role="tab"
          aria-selected={mode === 'auto'}
          onClick={() => setMode('auto')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
            mode === 'auto'
              ? 'bg-purple-600/20 border-purple-500 text-purple-400'
              : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
          }`}
        >
          <Zap size={13} /> Automated Backtest
        </button>
      </div>

      {mode === 'manual' ? (
        <ManualBacktest onResult={onResult} onUpdate={onUpdate} currentLegs={currentLegs} underlyingPrice={underlyingPrice} sharedPriceData={sharedPriceData} backtestPortfolios={backtestPortfolios} />
      ) : (
        <AutoBacktest onResult={onResult} onUpdate={onUpdate} sharedPriceData={sharedPriceData} backtestPortfolios={backtestPortfolios} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MANUAL BACKTEST
   ══════════════════════════════════════════════════════════ */

function ManualBacktest({ onResult, onUpdate, currentLegs, underlyingPrice, sharedPriceData, backtestPortfolios }) {
  const toast = useToast();
  const [symbol, setSymbol] = useState('SPY');
  const [dte, setDte] = useState(30);
  const [capital, setCapital] = useState(10000);
  const [commission, setCommission] = useState(0.65);
  const [riskFreeRate, setRiskFreeRate] = useState(5);
  const [divYield, setDivYield] = useState(0);
  const [targetPortfolioId, setTargetPortfolioId] = useState(''); // '' = new portfolio

  // Historical data
  const [historyRange, setHistoryRange] = useState('1y');
  const [rawPriceData, setRawPriceData] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [usingShared, setUsingShared] = useState(false);

  // Entry/exit selection
  const [entryDate, setEntryDate] = useState('');
  const [exitDate, setExitDate] = useState('');
  const [entryPrice, setEntryPrice] = useState(null);
  const [exitPrice, setExitPrice] = useState(null);

  // Manual legs
  const [legs, setLegs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Filter raw data by selected range
  const priceData = useMemo(() => {
    if (!rawPriceData.length) return [];
    if (historyRange === 'all') return rawPriceData;
    const now = new Date();
    const cutoffs = {
      '30d': 30, '90d': 90, '180d': 180,
      '1y': 365, '2y': 730, '5y': 1825, '10y': 3650,
    };
    const days = cutoffs[historyRange] || 365;
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return rawPriceData.filter((d) => d.date >= cutoffStr);
  }, [rawPriceData, historyRange]);

  // Use shared data from the Historical Data panel
  const useSharedData = useCallback(() => {
    if (!sharedPriceData?.data?.length) return;
    setRawPriceData(sharedPriceData.data);
    setSymbol(sharedPriceData.symbol);
    setUsingShared(true);
    setEntryDate('');
    setExitDate('');
    setEntryPrice(null);
    setExitPrice(null);
    setResult(null);
    setError('');
  }, [sharedPriceData]);

  // Load historical data
  const loadData = useCallback(async () => {
    setError('');
    setLoadingData(true);
    setUsingShared(false);
    setRawPriceData([]);
    setEntryDate('');
    setExitDate('');
    setEntryPrice(null);
    setExitPrice(null);
    setResult(null);
    try {
      const apiKey = getStoredAvKey();
      if (!apiKey) throw new Error('Alpha Vantage API key required. Set it in the Historical Data panel.');
      const needsFull = ['180d', '1y', '2y', '5y', '10y', 'all'].includes(historyRange);
      const outputSize = needsFull ? 'full' : 'compact';
      let data;
      try {
        data = await fetchDailyHistory(symbol, apiKey, outputSize);
      } catch (err) {
        // If full failed, fallback to compact
        if (outputSize === 'full') {
          data = await fetchDailyHistory(symbol, apiKey, 'compact');
          setError('Full output not available — loaded compact (~100 pts) instead.');
        } else {
          throw err;
        }
      }
      if (data.length < 10) throw new Error('Not enough historical data.');
      setRawPriceData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingData(false);
    }
  }, [symbol, historyRange]);

  // Import legs from the current simulator
  const importLegs = useCallback(() => {
    if (!currentLegs || currentLegs.length === 0) return;
    setLegs(currentLegs.map((l) => ({
      type: l.type,
      direction: l.direction,
      strike: l.strike,
      iv: l.iv,
      quantity: l.quantity,
      premium: l.premium || 0,
      useMarketPremium: false, // false = auto-calc at entry, true = use this premium
    })));
    setEntryDate('');
    setExitDate('');
    setEntryPrice(null);
    setExitPrice(null);
    setResult(null);
    setError('');
  }, [currentLegs]);

  // Add a blank leg
  const addLeg = useCallback(() => {
    setLegs((prev) => [...prev, {
      type: 'call', direction: 'long',
      strike: Math.round(entryPrice || underlyingPrice || 100),
      iv: 0.30, quantity: 1, premium: 0, useMarketPremium: false,
    }]);
  }, [entryPrice, underlyingPrice]);

  const updateLeg = useCallback((idx, field, value) => {
    setLegs((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }, []);

  const removeLeg = useCallback((idx) => {
    setLegs((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Chart click handler
  const handleChartClick = useCallback((data) => {
    if (!data?.activePayload?.[0]?.payload) return;
    const bar = data.activePayload[0].payload;
    if (!entryDate) {
      setEntryDate(bar.date);
      setEntryPrice(bar.close);
    } else if (!exitDate) {
      if (bar.date > entryDate) {
        setExitDate(bar.date);
        setExitPrice(bar.close);
      } else {
        // Clicked before entry — reset entry
        setEntryDate(bar.date);
        setEntryPrice(bar.close);
        setExitDate('');
        setExitPrice(null);
      }
    } else {
      // Both set — reset
      setEntryDate(bar.date);
      setEntryPrice(bar.close);
      setExitDate('');
      setExitPrice(null);
    }
  }, [entryDate, exitDate]);

  // Compute premiums at entry for display
  const legsWithEntryPremiums = useMemo(() => {
    if (!entryPrice || legs.length === 0) return legs;
    const r = riskFreeRate / 100;
    const t = dte / 365;
    return legs.map((leg) => {
      if (leg.useMarketPremium) return leg;
      const prices = bsmPrice(entryPrice, leg.strike, t, r, leg.iv, 0);
      const premium = leg.type === 'call' ? prices.call : prices.put;
      return { ...leg, premium: Math.round(premium * 100) / 100 };
    });
  }, [legs, entryPrice, dte, riskFreeRate]);

  // Net cost at entry
  const netCost = useMemo(() => {
    return legsWithEntryPremiums.reduce((sum, leg) => {
      return sum + (leg.direction === 'long' ? -1 : 1) * leg.premium * leg.quantity * 100;
    }, 0);
  }, [legsWithEntryPremiums]);

  // Run the manual backtest
  const run = useCallback(() => {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      if (legs.length === 0) throw new Error('Add at least one leg.');
      if (!entryDate) throw new Error('Click the chart to select an entry date.');

      const existingPortfolio = targetPortfolioId
        ? backtestPortfolios.find((p) => p.id === targetPortfolioId)
        : undefined;

      const res = runManualBacktest({
        legs: legsWithEntryPremiums,
        priceData,
        symbol: symbol.toUpperCase(),
        entryDate,
        exitDate: exitDate || undefined,
        dte,
        riskFreeRate: riskFreeRate / 100,
        divYield: divYield / 100,
        startingCapital: capital,
        commissionPerContract: commission,
        existingPortfolio,
      });

      setResult(res);
      if (existingPortfolio) {
        onUpdate(res.portfolio);
        toast.show(`Appended to "${existingPortfolio.name}"`, { intent: 'success' });
      } else {
        onResult(res.portfolio);
        toast.show('Backtest complete — portfolio saved', { intent: 'success' });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [legs, legsWithEntryPremiums, priceData, symbol, entryDate, exitDate, dte, riskFreeRate, divYield, capital, commission, onResult, onUpdate, targetPortfolioId, backtestPortfolios, toast]);

  // Thin data for chart
  const chartData = useMemo(() => {
    if (priceData.length <= 300) return priceData;
    const step = Math.max(1, Math.floor(priceData.length / 300));
    return priceData.filter((_, i) => i % step === 0 || i === priceData.length - 1);
  }, [priceData]);

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        Pick a historical entry point on the chart, configure your trade legs, and see how it would have played out.
      </div>

      {/* Symbol + Load */}
      <div className="flex items-end gap-2 text-xs flex-wrap">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Symbol</span>
          <input
            type="text" value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="px-2 py-1 rounded w-24" placeholder="SPY"
            aria-label="Ticker symbol"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">History Range</span>
          <select
            value={historyRange}
            onChange={(e) => setHistoryRange(e.target.value)}
            className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700"
            aria-label="History range"
          >
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
            <option value="180d">6 Months</option>
            <option value="1y">1 Year</option>
            <option value="2y">2 Years</option>
            <option value="5y">5 Years</option>
            <option value="10y">10 Years</option>
            <option value="all">All Data (20y+)</option>
          </select>
        </label>
        <Button variant="secondary" size="md" onClick={loadData} loading={loadingData}>
          {loadingData ? 'Loading...' : 'Load History'}
        </Button>
        {sharedPriceData?.data?.length > 0 && (
          <Button
            variant="success"
            size="md"
            onClick={useSharedData}
            title={`Use ${sharedPriceData.symbol} data already loaded in the Historical Data panel (${sharedPriceData.data.length} pts)`}
          >
            Use {sharedPriceData.symbol} ({sharedPriceData.data.length} pts)
          </Button>
        )}
        {priceData.length > 0 && (
          <span className={`text-[10px] self-end pb-1 ${usingShared ? 'text-emerald-500' : 'text-slate-500'}`}>
            {usingShared ? '● Shared — ' : ''}{priceData.length} days ({priceData[0]?.date} → {priceData[priceData.length - 1]?.date})
          </span>
        )}
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">DTE (days)</span>
          <input type="number" value={dte} onChange={(e) => setDte(+e.target.value || 30)} className="px-2 py-1 rounded w-16" min="1" step="1" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Capital $</span>
          <input type="number" value={capital} onChange={(e) => setCapital(+e.target.value || 10000)} className="px-2 py-1 rounded w-24" min="100" step="100" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Rate %</span>
          <input type="number" value={riskFreeRate} onChange={(e) => setRiskFreeRate(+e.target.value || 0)} className="px-2 py-1 rounded w-16" step="0.5" min="0" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Div Yield %</span>
          <input type="number" value={divYield} onChange={(e) => setDivYield(+e.target.value || 0)} className="px-2 py-1 rounded w-16" step="0.1" min="0" />
        </label>
      </div>

      {/* Portfolio target selector */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">Save to:</span>
        <select
          value={targetPortfolioId}
          onChange={(e) => setTargetPortfolioId(e.target.value)}
          className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 text-xs"
        >
          <option value="">New Portfolio</option>
          {backtestPortfolios.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.trades.length} trades)</option>
          ))}
        </select>
        {targetPortfolioId && (
          <span className="text-[10px] text-amber-400">Results will be appended to existing portfolio</span>
        )}
      </div>

      {/* Price chart with click-to-select */}
      {priceData.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 mb-1">
            Click to set entry{entryDate ? ` → then click again for exit` : ''}.
            {entryDate && (
              <button
                onClick={() => { setEntryDate(''); setExitDate(''); setEntryPrice(null); setExitPrice(null); }}
                className="ml-2 text-blue-400 hover:text-blue-300"
              >
                Clear selection
              </button>
            )}
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }}
                  interval={Math.max(0, Math.floor(chartData.length / 6))}
                />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Close']}
                />
                <Line type="monotone" dataKey="close" stroke="#60a5fa" dot={false} strokeWidth={1.5} />
                {entryDate && (
                  <ReferenceLine x={entryDate} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'ENTRY', fill: '#22c55e', fontSize: 9, position: 'top' }} />
                )}
                {exitDate && (
                  <ReferenceLine x={exitDate} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'EXIT', fill: '#ef4444', fontSize: 9, position: 'top' }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {/* Entry/exit info */}
          <div className="flex gap-4 text-xs mt-1">
            {entryDate && (
              <span className="text-green-400">
                Entry: {entryDate} @ ${entryPrice?.toFixed(2)}
              </span>
            )}
            {exitDate && (
              <span className="text-red-400">
                Exit: {exitDate} @ ${exitPrice?.toFixed(2)}
              </span>
            )}
            {!exitDate && entryDate && (
              <span className="text-slate-500">Hold to expiry ({dte}d)</span>
            )}
          </div>
        </div>
      )}

      {/* Legs */}
      {priceData.length > 0 && (
        <div className="border border-slate-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Trade Legs</div>
            <div className="flex gap-1">
              {currentLegs && currentLegs.length > 0 && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={importLegs}
                  className="!bg-blue-600/20 !text-blue-400 !border-blue-500/30 hover:!bg-blue-600/30"
                >
                  Import from Simulator ({currentLegs.length})
                </Button>
              )}
              <Button variant="secondary" size="xs" icon={Plus} onClick={addLeg}>Add Leg</Button>
            </div>
          </div>

          {legs.length === 0 && (
            <EmptyState
              icon={Inbox}
              title="No legs yet"
              helper="Add legs manually or import your current strategy from the simulator."
              size="sm"
            />
          )}

          {legs.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 text-left bg-slate-900">
                    <th className="px-1.5 py-1.5 sticky-th">Type</th>
                    <th className="px-1.5 py-1.5 sticky-th">Dir</th>
                    <th className="px-1.5 py-1.5 text-right sticky-th">Strike</th>
                    <th className="px-1.5 py-1.5 text-right sticky-th">IV %</th>
                    <th className="px-1.5 py-1.5 text-right sticky-th">Qty</th>
                    <th className="px-1.5 py-1.5 text-right sticky-th">Premium</th>
                    <th className="px-1.5 py-1.5 sticky-th"></th>
                  </tr>
                </thead>
                <tbody>
                  {legsWithEntryPremiums.map((leg, i) => (
                    <tr key={i} className="border-t border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-1.5 py-1.5">
                        <select value={leg.type} onChange={(e) => updateLeg(i, 'type', e.target.value)}
                          aria-label={`Leg ${i + 1} type`}
                          className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs">
                          <option value="call">Call</option>
                          <option value="put">Put</option>
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5">
                        <select value={leg.direction} onChange={(e) => updateLeg(i, 'direction', e.target.value)}
                          aria-label={`Leg ${i + 1} direction`}
                          className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs">
                          <option value="long">Long</option>
                          <option value="short">Short</option>
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input type="number" value={leg.strike}
                          onChange={(e) => updateLeg(i, 'strike', +e.target.value || 0)}
                          aria-label={`Leg ${i + 1} strike`}
                          min="0.01" step="0.5"
                          className="w-16 text-right" />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input type="number" value={(leg.iv * 100).toFixed(0)}
                          onChange={(e) => updateLeg(i, 'iv', (+e.target.value || 0) / 100)}
                          aria-label={`Leg ${i + 1} IV percent`}
                          className="w-14 text-right" step="1" min="1" max="300" />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input type="number" value={leg.quantity}
                          onChange={(e) => updateLeg(i, 'quantity', Math.max(1, +e.target.value || 1))}
                          aria-label={`Leg ${i + 1} quantity`}
                          className="w-12 text-right" min="1" step="1" />
                      </td>
                      <td className="px-1.5 py-1.5 text-right font-mono text-slate-400">
                        {formatCurrency(leg.premium)}
                      </td>
                      <td className="px-1.5 py-1.5">
                        <ConfirmButton
                          onConfirm={() => removeLeg(i)}
                          ariaLabel={`Remove leg ${i + 1}`}
                          confirmLabel="Remove"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {entryPrice && legs.length > 0 && (
                <div className="text-xs text-slate-400 mt-1 px-1.5">
                  Net cost at entry: <span className={`font-mono font-semibold ${netCost >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(netCost)}
                  </span>
                  <span className="text-slate-600 ml-1">(premiums auto-calculated via BSM at entry spot)</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Run button */}
      {legs.length > 0 && entryDate && (
        <Button variant="primary" size="md" icon={loading ? undefined : Play} loading={loading} onClick={run}>
          {loading ? 'Running...' : 'Run Manual Backtest'}
        </Button>
      )}

      {error && <ErrorBox intent="error">{error}</ErrorBox>}

      {result && <BacktestResultCard result={result} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   AUTOMATED BACKTEST
   ══════════════════════════════════════════════════════════ */

function AutoBacktest({ onResult, onUpdate, sharedPriceData, backtestPortfolios }) {
  const toast = useToast();
  const [symbol, setSymbol] = useState('SPY');
  const [strategy, setStrategy] = useState(STRATEGY_NAMES[0]);
  const [dte, setDte] = useState(30);
  const [entryInterval, setEntryInterval] = useState(30);
  const [iv, setIv] = useState(30);
  const [capital, setCapital] = useState(10000);
  const [commission, setCommission] = useState(0.65);
  const [stopLoss, setStopLoss] = useState(0);
  const [takeProfit, setTakeProfit] = useState(0);
  const [trailingStop, setTrailingStop] = useState(0);
  const [managementDte, setManagementDte] = useState(0);
  const [riskFreeRate, setRiskFreeRate] = useState(5);
  const [divYield, setDivYield] = useState(0);
  const [bidAskSpread, setBidAskSpread] = useState(0);
  const [positionSizing, setPositionSizing] = useState('fixed');
  const [riskPct, setRiskPct] = useState(2);
  const [useSkew, setUseSkew] = useState(false);
  const [useShared, setUseShared] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [targetPortfolioId, setTargetPortfolioId] = useState(''); // '' = new portfolio

  const sharedHasVix = useShared && sharedPriceData?.data?.some((b) => b.iv != null);

  const run = useCallback(async () => {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      let priceData;
      if (useShared && sharedPriceData?.data?.length > 0) {
        priceData = sharedPriceData.data;
      } else {
        const apiKey = getStoredAvKey();
        if (!apiKey) throw new Error('Alpha Vantage API key required. Set it in the Historical Data panel.');
        try {
          priceData = await fetchDailyHistoryWithVix(symbol, apiKey, 'full');
        } catch {
          priceData = await fetchDailyHistoryWithVix(symbol, apiKey, 'compact');
        }
      }
      if (priceData.length < 30) throw new Error('Not enough historical data (need 30+ days).');

      const existingPortfolio = targetPortfolioId
        ? backtestPortfolios.find((p) => p.id === targetPortfolioId)
        : undefined;

      const res = runBacktest({
        strategy,
        priceData,
        symbol: (useShared ? sharedPriceData?.symbol : symbol).toUpperCase(),
        dte,
        entryInterval,
        iv: iv / 100,
        riskFreeRate: riskFreeRate / 100,
        divYield: divYield / 100,
        startingCapital: capital,
        commissionPerContract: commission,
        stopLossPct: stopLoss,
        takeProfitPct: takeProfit,
        trailingStopPct: trailingStop,
        managementDte,
        bidAskSpread: bidAskSpread / 100,
        positionSizing,
        riskPct,
        skewSlope: useSkew ? -0.5 : 0,
        existingPortfolio,
      });

      setResult(res);
      if (existingPortfolio) {
        onUpdate(res.portfolio);
        toast.show(`Appended to "${existingPortfolio.name}"`, { intent: 'success' });
      } else {
        onResult(res.portfolio);
        toast.show('Automated backtest complete — portfolio saved', { intent: 'success' });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [symbol, strategy, dte, entryInterval, iv, capital, commission, stopLoss, takeProfit, trailingStop, managementDte, riskFreeRate, divYield, bidAskSpread, positionSizing, riskPct, useSkew, onResult, onUpdate, useShared, sharedPriceData, targetPortfolioId, backtestPortfolios, toast]);

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        Automatically runs a strategy repeatedly across the full price history at regular intervals.
      </div>

      {sharedPriceData?.data?.length > 0 && (
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={useShared}
            onChange={(e) => setUseShared(e.target.checked)}
            className="accent-emerald-500"
          />
          <span className={useShared ? 'text-emerald-400' : 'text-slate-500'}>
            Use data from Historical Data panel
            <span className="text-slate-600 ml-1">
              ({sharedPriceData.symbol}, {sharedPriceData.data.length} pts, {sharedPriceData.data[0]?.date} → {sharedPriceData.data[sharedPriceData.data.length - 1]?.date})
            </span>
          </span>
        </label>
      )}

      {/* Core parameters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Symbol</span>
          <input
            type="text" value={useShared ? (sharedPriceData?.symbol || symbol) : symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="px-2 py-1 rounded" placeholder="SPY"
            disabled={useShared}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Strategy</span>
          <select
            value={strategy} onChange={(e) => setStrategy(e.target.value)}
            className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700"
          >
            {STRATEGY_NAMES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">DTE (days)</span>
          <input type="number" value={dte} onChange={(e) => setDte(+e.target.value || 30)} className="px-2 py-1 rounded" min="1" step="1" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Entry Interval (days)</span>
          <input type="number" value={entryInterval} onChange={(e) => setEntryInterval(+e.target.value || 30)} className="px-2 py-1 rounded" min="1" step="1" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
            ATM IV %
            {sharedHasVix
              ? <span className="text-emerald-400 font-medium">(using VIX)</span>
              : <span className="text-slate-600">(VIX when fetched)</span>}
          </span>
          <input
            type="number"
            value={iv}
            onChange={(e) => setIv(+e.target.value || 30)}
            className={`px-2 py-1 rounded ${sharedHasVix ? 'opacity-40 cursor-not-allowed' : ''}`}
            min="1" max="200"
            disabled={sharedHasVix}
            title={sharedHasVix ? 'Historical VIX data is being used from shared price data' : 'Fallback IV when VIX data is unavailable'}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Starting Capital $</span>
          <input type="number" value={capital} onChange={(e) => setCapital(+e.target.value || 10000)} className="px-2 py-1 rounded" min="100" step="100" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Commission / Contract $</span>
          <input type="number" value={commission} onChange={(e) => setCommission(+e.target.value || 0)} className="px-2 py-1 rounded" min="0" step="0.05" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Risk-Free Rate %</span>
          <input type="number" value={riskFreeRate} onChange={(e) => setRiskFreeRate(+e.target.value || 0)} className="px-2 py-1 rounded" min="0" step="0.5" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Div Yield %</span>
          <input type="number" value={divYield} onChange={(e) => setDivYield(+e.target.value || 0)} className="px-2 py-1 rounded" min="0" step="0.1" />
        </label>
      </div>

      {/* Exit rules */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1.5">Exit Rules</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Stop Loss % (0=off)</span>
            <input type="number" value={stopLoss} onChange={(e) => setStopLoss(+e.target.value || 0)} className="px-2 py-1 rounded" min="0" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Take Profit % (0=off)</span>
            <input type="number" value={takeProfit} onChange={(e) => setTakeProfit(+e.target.value || 0)} className="px-2 py-1 rounded" min="0" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Trailing Stop % (0=off)</span>
            <input type="number" value={trailingStop} onChange={(e) => setTrailingStop(+e.target.value || 0)} className="px-2 py-1 rounded" min="0" title="Close when P&L drops this % from its peak" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Manage at DTE (0=off)</span>
            <input type="number" value={managementDte} onChange={(e) => setManagementDte(+e.target.value || 0)} className="px-2 py-1 rounded" min="0" title="Close when days-to-expiry reaches this value" />
          </label>
        </div>
      </div>

      {/* Advanced parameters */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1.5">Advanced</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Bid-Ask Spread % (0=off)</span>
            <input type="number" value={bidAskSpread} onChange={(e) => setBidAskSpread(+e.target.value || 0)} className="px-2 py-1 rounded" min="0" max="50" step="0.5" title="Half-spread applied at each fill as % of option price" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Position Sizing</span>
            <select value={positionSizing} onChange={(e) => setPositionSizing(e.target.value)}
              className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">
              <option value="fixed">Fixed (1 contract)</option>
              <option value="fractional">Fractional (% of capital)</option>
            </select>
          </label>
          {positionSizing === 'fractional' && (
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Risk per Trade %</span>
              <input type="number" value={riskPct} onChange={(e) => setRiskPct(+e.target.value || 1)} className="px-2 py-1 rounded" min="0.1" max="100" step="0.5" title="% of current capital allocated per debit trade" />
            </label>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer pt-4">
            <input type="checkbox" checked={useSkew} onChange={(e) => setUseSkew(e.target.checked)} className="accent-purple-500" />
            <span className={useSkew ? 'text-purple-300' : 'text-slate-500'}>Equity vol skew</span>
          </label>
        </div>
        {useSkew && (
          <div className="text-[10px] text-slate-500 mt-1">
            Applies a slope of −0.5 to IV: OTM puts priced richer, OTM calls cheaper (realistic equity skew).
          </div>
        )}
      </div>

      {/* Portfolio target selector */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">Save to:</span>
        <select
          value={targetPortfolioId}
          onChange={(e) => setTargetPortfolioId(e.target.value)}
          className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 text-xs"
        >
          <option value="">New Portfolio</option>
          {backtestPortfolios.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.trades.length} trades)</option>
          ))}
        </select>
        {targetPortfolioId && (
          <span className="text-[10px] text-amber-400">Results will be appended to existing portfolio</span>
        )}
      </div>

      <Button
        variant="primary"
        size="md"
        icon={loading ? undefined : Play}
        loading={loading}
        onClick={run}
        className="!bg-purple-600 hover:!bg-purple-500 !border-purple-500/40"
      >
        {loading ? 'Running Backtest...' : 'Run Automated Backtest'}
      </Button>

      {error && <ErrorBox intent="error">{error}</ErrorBox>}

      {result && <BacktestResultCard result={result} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SHARED RESULT CARD
   ══════════════════════════════════════════════════════════ */

function BacktestResultCard({ result }) {
  const { metrics, equityCurve, portfolio } = result;
  const firstSnap = equityCurve[0];
  const lastSnap = equityCurve[equityCurve.length - 1];
  const returnPct = firstSnap && firstSnap.totalValue > 0
    ? ((lastSnap.totalValue - firstSnap.totalValue) / firstSnap.totalValue * 100)
    : 0;

  // Thin equity curve for chart, enriched with buy-and-hold benchmark
  const step = Math.max(1, Math.floor(equityCurve.length / 150));
  const rawSnaps = equityCurve.filter((_, i) => i % step === 0 || i === equityCurve.length - 1);
  const startCapital = portfolio?.config?.startingCapital ?? firstSnap?.totalValue ?? 10000;
  const firstSpot = firstSnap?.spotPrice ?? 1;
  const chartSnaps = rawSnaps.map((s) => ({
    ...s,
    benchmarkValue: firstSpot > 0 ? Math.round(startCapital * (s.spotPrice / firstSpot) * 100) / 100 : startCapital,
  }));

  // CSV export of closed trade log
  const exportCsv = useCallback(() => {
    if (!portfolio?.trades) return;
    const closed = portfolio.trades.filter((t) => t.status !== 'open');
    const header = 'GroupID,Symbol,Type,Direction,Strike,IV%,OpenDate,CloseDate,Status,EntryPremium,ExitPrice,Qty,PnL';
    const rows = closed.map((t) => {
      const dir = t.direction === 'long' ? 1 : -1;
      const comm = t.quantity * (t._commission ?? 0.65);
      const pnl = dir * ((t.closePrice ?? t.premium) - t.premium) * t.quantity * 100 - comm * 2;
      return [
        t.groupId, t.symbol, t.type, t.direction,
        t.strike, (t.iv * 100).toFixed(0),
        t.openedAt?.slice(0, 10), t.closedAt?.slice(0, 10),
        t.status, t.premium.toFixed(2),
        (t.closePrice ?? t.premium).toFixed(2),
        t.quantity, pnl.toFixed(2),
      ].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest_trades_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [portfolio]);

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          Results
          <span className="text-[10px] text-slate-500 normal-case tracking-normal">
            ({equityCurve.length} days, {firstSnap?.date} → {lastSnap?.date})
          </span>
        </div>
        <Button
          variant="secondary"
          size="xs"
          icon={Download}
          onClick={exportCsv}
          title="Download trade log as CSV"
        >
          CSV
        </Button>
      </div>

      {/* Core metrics grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
        <StatCard size="sm" label="Total P&L" value={formatCurrency(metrics.totalPnl)} sign={metrics.totalPnl >= 0 ? 'positive' : 'negative'} />
        <StatCard size="sm" label="Return" value={`${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%`} sign={returnPct >= 0 ? 'positive' : 'negative'} />
        <StatCard size="sm" label="Win Rate" value={`${(metrics.winRate * 100).toFixed(1)}%`} />
        <StatCard size="sm" label="Profit Factor" value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)} />
        <StatCard size="sm" label="Max DD" value={`${(metrics.maxDrawdown * 100).toFixed(1)}%`} sign="negative" />
        <StatCard size="sm" label="Sharpe" value={metrics.sharpe.toFixed(2)} />
        <StatCard size="sm" label="Sortino" value={metrics.sortino.toFixed(2)} />
        <StatCard size="sm" label="Calmar" value={isFinite(metrics.calmar) ? metrics.calmar.toFixed(2) : '—'} />
        <StatCard size="sm" label="Trades" value={metrics.totalTrades} />
        <StatCard size="sm" label="Winners" value={metrics.winners} sign="positive" />
        <StatCard size="sm" label="Losers" value={metrics.losers} sign="negative" />
        <StatCard size="sm" label="Max Consec L" value={metrics.maxConsecLosers} sign="negative" />
        <StatCard size="sm" label="Avg Win" value={formatCurrency(metrics.avgWin)} sign="positive" />
        <StatCard size="sm" label="Avg Loss" value={formatCurrency(metrics.avgLoss)} sign="negative" />
      </div>

      {/* Equity curve with buy-and-hold benchmark overlay */}
      {chartSnaps.length > 2 && (
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartSnaps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#64748b' }} interval={Math.max(0, Math.floor(chartSnaps.length / 5))} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 10 }}
                formatter={(v, name) => [`$${Number(v).toFixed(0)}`, name === 'totalValue' ? 'Strategy' : 'Buy & Hold']}
              />
              <Legend wrapperStyle={{ fontSize: 9, paddingTop: 2 }} />
              <Area type="monotone" dataKey="totalValue" name="Strategy" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.1} strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="benchmarkValue" name="Buy & Hold" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="4 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-year breakdown */}
      {metrics.yearlyReturns && metrics.yearlyReturns.length > 1 && (
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Year-by-Year</div>
          <div className="overflow-x-auto rounded border border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-left bg-slate-900">
                  <th className="px-1.5 py-1 sticky-th">Year</th>
                  <th className="px-1.5 py-1 text-right sticky-th">Return</th>
                  <th className="px-1.5 py-1 text-right sticky-th">P&L</th>
                </tr>
              </thead>
              <tbody>
                {metrics.yearlyReturns.map(({ year, returnPct: rp, pnl }) => (
                  <tr key={year} className="border-t border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-1.5 py-1 text-slate-400">{year}</td>
                    <td className={`px-1.5 py-1 text-right font-mono font-semibold ${rp >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {rp >= 0 ? '+' : ''}{rp.toFixed(1)}%
                    </td>
                    <td className={`px-1.5 py-1 text-right font-mono ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
