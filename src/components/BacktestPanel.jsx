import { useState, useCallback } from 'react';
import { Play, Loader, AlertTriangle } from 'lucide-react';
import { STRATEGY_NAMES, runBacktest } from '../lib/backtestEngine.js';
import { fetchDailyHistory, getStoredAvKey } from '../lib/alphaVantageApi.js';
import { calcMetrics } from '../lib/portfolio.js';

const fmtMoney = (n) => {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function BacktestPanel({ onResult }) {
  const [symbol, setSymbol] = useState('SPY');
  const [strategy, setStrategy] = useState(STRATEGY_NAMES[0]);
  const [dte, setDte] = useState(30);
  const [entryInterval, setEntryInterval] = useState(30);
  const [iv, setIv] = useState(30);
  const [capital, setCapital] = useState(10000);
  const [commission, setCommission] = useState(0.65);
  const [stopLoss, setStopLoss] = useState(0);
  const [takeProfit, setTakeProfit] = useState(0);
  const [riskFreeRate, setRiskFreeRate] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const run = useCallback(async () => {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const apiKey = getStoredAvKey();
      if (!apiKey) throw new Error('Alpha Vantage API key required. Set it in the Historical Data panel.');

      const priceData = await fetchDailyHistory(symbol, apiKey, 'full');
      if (priceData.length < 30) throw new Error('Not enough historical data.');

      const res = runBacktest({
        strategy,
        priceData,
        symbol: symbol.toUpperCase(),
        dte,
        entryInterval,
        iv: iv / 100,
        riskFreeRate: riskFreeRate / 100,
        divYield: 0,
        startingCapital: capital,
        commissionPerContract: commission,
        stopLossPct: stopLoss,
        takeProfitPct: takeProfit,
      });

      setResult(res);
      onResult(res.portfolio);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [symbol, strategy, dte, entryInterval, iv, capital, commission, stopLoss, takeProfit, riskFreeRate, onResult]);

  return (
    <div className="space-y-3">
      {/* Config */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-500">Symbol</span>
          <input
            type="text" value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="px-2 py-1 rounded"
            placeholder="SPY"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-500">Strategy</span>
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
          <span className="text-slate-500">DTE</span>
          <input type="number" value={dte} onChange={(e) => setDte(+e.target.value || 30)} className="px-2 py-1 rounded" min="1" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-500">Entry Interval (days)</span>
          <input type="number" value={entryInterval} onChange={(e) => setEntryInterval(+e.target.value || 30)} className="px-2 py-1 rounded" min="1" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-500">IV %</span>
          <input type="number" value={iv} onChange={(e) => setIv(+e.target.value || 30)} className="px-2 py-1 rounded" min="1" max="200" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-500">Starting Capital $</span>
          <input type="number" value={capital} onChange={(e) => setCapital(+e.target.value || 10000)} className="px-2 py-1 rounded" min="100" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-500">Commission / contract $</span>
          <input type="number" value={commission} onChange={(e) => setCommission(+e.target.value || 0)} className="px-2 py-1 rounded" min="0" step="0.05" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-500">Risk-Free Rate %</span>
          <input type="number" value={riskFreeRate} onChange={(e) => setRiskFreeRate(+e.target.value || 0)} className="px-2 py-1 rounded" min="0" step="0.5" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-500">Stop Loss % (0 = off)</span>
          <input type="number" value={stopLoss} onChange={(e) => setStopLoss(+e.target.value || 0)} className="px-2 py-1 rounded" min="0" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-500">Take Profit % (0 = off)</span>
          <input type="number" value={takeProfit} onChange={(e) => setTakeProfit(+e.target.value || 0)} className="px-2 py-1 rounded" min="0" />
        </label>
      </div>

      <button
        onClick={run}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-xs font-medium"
      >
        {loading ? <Loader size={13} className="animate-spin" /> : <Play size={13} />}
        {loading ? 'Running Backtest...' : 'Run Backtest'}
      </button>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      {/* Quick results summary */}
      {result && <BacktestSummary result={result} />}
    </div>
  );
}

function BacktestSummary({ result }) {
  const { metrics, equityCurve } = result;
  const firstSnap = equityCurve[0];
  const lastSnap = equityCurve[equityCurve.length - 1];
  const returnPct = firstSnap ? ((lastSnap.totalValue - firstSnap.totalValue) / firstSnap.totalValue * 100) : 0;

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
      <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
        Backtest Results
        <span className="text-[10px] text-slate-500">
          ({equityCurve.length} days, {firstSnap?.date} → {lastSnap?.date})
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
        <Stat label="Total P&L" value={fmtMoney(metrics.totalPnl)} positive={metrics.totalPnl >= 0} />
        <Stat label="Return" value={`${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%`} positive={returnPct >= 0} />
        <Stat label="Win Rate" value={`${(metrics.winRate * 100).toFixed(1)}%`} />
        <Stat label="Profit Factor" value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)} />
        <Stat label="Max DD" value={`${(metrics.maxDrawdown * 100).toFixed(1)}%`} positive={false} />
        <Stat label="Sharpe" value={metrics.sharpe.toFixed(2)} />
        <Stat label="Trades" value={metrics.totalTrades} />
        <Stat label="Winners" value={metrics.winners} positive={true} />
        <Stat label="Losers" value={metrics.losers} positive={false} />
        <Stat label="Avg Win" value={fmtMoney(metrics.avgWin)} positive={true} />
      </div>
    </div>
  );
}

function Stat({ label, value, positive }) {
  const color =
    positive === true ? 'text-green-400' :
    positive === false ? 'text-red-400' :
    'text-slate-200';
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      <div className={`font-mono font-semibold ${color}`}>{value}</div>
    </div>
  );
}
