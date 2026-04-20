import { useState, useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Trash2, X, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { calcMetrics, portfolioPnl, portfolioGreeks } from '../lib/portfolio.js';

const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '$0.00';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtPct = (n) => `${(n * 100).toFixed(1)}%`;

export default function PortfolioTracker({ portfolios, onDelete, onDeleteTrade, onSelect, selectedId }) {
  const [detailId, setDetailId] = useState(null);
  const detail = portfolios.find((p) => p.id === detailId);

  // Aggregate metrics across all portfolios in this view
  const aggregate = useMemo(() => {
    if (portfolios.length === 0) return null;
    const allMetrics = portfolios.map((pf) => calcMetrics(pf));
    const totalPnl = allMetrics.reduce((s, m) => s + m.totalPnl, 0);
    const totalTrades = allMetrics.reduce((s, m) => s + m.totalTrades, 0);
    const totalWinners = allMetrics.reduce((s, m) => s + m.winners, 0);
    const totalLosers = allMetrics.reduce((s, m) => s + m.losers, 0);
    const winRate = totalTrades > 0 ? totalWinners / totalTrades : 0;

    const grossWin = allMetrics.reduce((s, m) => s + m.avgWin * m.winners, 0);
    const grossLoss = allMetrics.reduce((s, m) => s + m.avgLoss * m.losers, 0);
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

    // Worst drawdown across portfolios
    const maxDrawdown = Math.max(0, ...allMetrics.map((m) => m.maxDrawdown));

    // Best and worst portfolios
    const sorted = [...portfolios].map((pf, i) => ({ pf, pnl: allMetrics[i].totalPnl }));
    sorted.sort((a, b) => b.pnl - a.pnl);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    // Total starting capital and ending value
    const totalCapital = portfolios.reduce((s, pf) => s + pf.config.startingCapital, 0);
    const totalEnding = portfolios.reduce((s, pf) => {
      const lastSnap = pf.snapshots[pf.snapshots.length - 1];
      return s + (lastSnap ? lastSnap.totalValue : pf.config.startingCapital);
    }, 0);
    const returnPct = totalCapital > 0 ? (totalEnding - totalCapital) / totalCapital : 0;

    return {
      totalPnl, totalTrades, totalWinners, totalLosers, winRate,
      profitFactor, maxDrawdown, totalCapital, totalEnding, returnPct,
      best, worst, count: portfolios.length,
    };
  }, [portfolios]);

  if (detail) {
    return <PortfolioDetail portfolio={detail} onBack={() => setDetailId(null)} onDeleteTrade={onDeleteTrade} />;
  }

  return (
    <div className="space-y-3">
      {portfolios.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm">
          No portfolios yet. Run a backtest or start forward testing to create one.
        </div>
      )}

      {/* ── Aggregate Summary ────────────────────────── */}
      {aggregate && (
        <div className="bg-[#111827] rounded-lg border border-slate-800 p-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">
            Summary — {aggregate.count} Portfolio{aggregate.count !== 1 ? 's' : ''}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div>
              <div className="text-[10px] text-slate-500">Total P&L</div>
              <div className={`text-sm font-mono font-semibold ${aggregate.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtMoney(aggregate.totalPnl)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Return</div>
              <div className={`text-sm font-mono font-semibold ${aggregate.returnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {aggregate.returnPct >= 0 ? '+' : ''}{fmtPct(aggregate.returnPct)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Win Rate</div>
              <div className="text-sm font-mono font-semibold text-slate-200">{fmtPct(aggregate.winRate)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Total Trades</div>
              <div className="text-sm font-mono font-semibold text-slate-200">{aggregate.totalTrades}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Profit Factor</div>
              <div className="text-sm font-mono font-semibold text-slate-200">
                {aggregate.profitFactor === Infinity ? '∞' : aggregate.profitFactor.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Max Drawdown</div>
              <div className="text-sm font-mono font-semibold text-red-400">{fmtPct(aggregate.maxDrawdown)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-800">
            <div>
              <div className="text-[10px] text-slate-500">Total Capital</div>
              <div className="text-xs font-mono text-slate-300">{fmtMoney(aggregate.totalCapital)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Ending Value</div>
              <div className="text-xs font-mono text-slate-300">{fmtMoney(aggregate.totalEnding)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">W / L</div>
              <div className="text-xs font-mono">
                <span className="text-green-400">{aggregate.totalWinners}</span>
                <span className="text-slate-600"> / </span>
                <span className="text-red-400">{aggregate.totalLosers}</span>
              </div>
            </div>
            {aggregate.count > 1 && (
              <div>
                <div className="text-[10px] text-slate-500">Best / Worst</div>
                <div className="text-xs font-mono">
                  <span className="text-green-400">{fmtMoney(aggregate.best.pnl)}</span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-red-400">{fmtMoney(aggregate.worst.pnl)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {portfolios.map((pf) => {
        const metrics = calcMetrics(pf);
        const lastSnap = pf.snapshots[pf.snapshots.length - 1];
        return (
          <div
            key={pf.id}
            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
              selectedId === pf.id
                ? 'border-blue-500 bg-blue-500/5'
                : 'border-slate-700 hover:border-slate-600'
            }`}
            onClick={() => setDetailId(pf.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  pf.mode === 'backtest'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-green-500/20 text-green-400'
                }`}>
                  {pf.mode === 'backtest' ? 'BACKTEST' : 'FORWARD'}
                </span>
                <span className="text-sm font-medium text-slate-200">{pf.name}</span>
                {pf.symbol && <span className="text-xs text-slate-500">{pf.symbol}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(pf.id); }}
                  className="p-1 text-red-500/60 hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-slate-500">Total P&L</div>
                <div className={`font-mono font-semibold ${metrics.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtMoney(metrics.totalPnl)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Win Rate</div>
                <div className="font-mono text-slate-200">{fmtPct(metrics.winRate)}</div>
              </div>
              <div>
                <div className="text-slate-500">Trades</div>
                <div className="font-mono text-slate-200">{metrics.totalTrades}</div>
              </div>
              <div>
                <div className="text-slate-500">Profit Factor</div>
                <div className="font-mono text-slate-200">
                  {metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
                </div>
              </div>
            </div>
            {/* Mini equity curve */}
            {pf.snapshots.length > 1 && (
              <div className="mt-2 h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={pf.snapshots}>
                    <Line
                      type="monotone" dataKey="totalValue" stroke="#60a5fa"
                      dot={false} strokeWidth={1.5}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Detail view ────────────────────────────────────────── */

function PortfolioDetail({ portfolio, onBack, onDeleteTrade }) {
  const [tab, setTab] = useState('overview'); // 'overview' | 'trades' | 'equity'
  const metrics = calcMetrics(portfolio);

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 mb-3"
      >
        <X size={13} /> Back to portfolios
      </button>

      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
          portfolio.mode === 'backtest'
            ? 'bg-purple-500/20 text-purple-400'
            : 'bg-green-500/20 text-green-400'
        }`}>
          {portfolio.mode === 'backtest' ? 'BACKTEST' : 'FORWARD'}
        </span>
        <h3 className="text-sm font-semibold text-slate-200">{portfolio.name}</h3>
        {portfolio.symbol && <span className="text-xs text-slate-500">{portfolio.symbol}</span>}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-3 border-b border-slate-800 pb-1">
        {['overview', 'trades', 'equity'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2.5 py-1 text-xs rounded-t ${
              tab === t ? 'text-blue-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab metrics={metrics} portfolio={portfolio} />}
      {tab === 'trades' && <TradesTab portfolio={portfolio} onDeleteTrade={onDeleteTrade} />}
      {tab === 'equity' && <EquityTab portfolio={portfolio} />}
    </div>
  );
}

function OverviewTab({ metrics, portfolio }) {
  const stats = [
    { label: 'Total P&L', value: fmtMoney(metrics.totalPnl), color: metrics.totalPnl >= 0 ? 'text-green-400' : 'text-red-400' },
    { label: 'Win Rate', value: fmtPct(metrics.winRate), color: 'text-slate-200' },
    { label: 'Winners', value: metrics.winners, color: 'text-green-400' },
    { label: 'Losers', value: metrics.losers, color: 'text-red-400' },
    { label: 'Avg Win', value: fmtMoney(metrics.avgWin), color: 'text-green-400' },
    { label: 'Avg Loss', value: fmtMoney(metrics.avgLoss), color: 'text-red-400' },
    { label: 'Profit Factor', value: metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2), color: 'text-slate-200' },
    { label: 'Max Drawdown', value: fmtPct(metrics.maxDrawdown), color: 'text-red-400' },
    { label: 'Sharpe Ratio', value: metrics.sharpe.toFixed(2), color: 'text-slate-200' },
    { label: 'Total Trades', value: metrics.totalTrades, color: 'text-slate-200' },
    { label: 'Starting Capital', value: fmtMoney(portfolio.config.startingCapital), color: 'text-slate-200' },
    {
      label: 'Ending Value',
      value: fmtMoney(
        portfolio.snapshots.length > 0
          ? portfolio.snapshots[portfolio.snapshots.length - 1].totalValue
          : portfolio.config.startingCapital
      ),
      color: 'text-slate-200',
    },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-slate-800/50 rounded p-2">
          <div className="text-[10px] text-slate-500 uppercase">{s.label}</div>
          <div className={`text-sm font-mono font-semibold ${s.color}`}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function TradesTab({ portfolio, onDeleteTrade }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'open' | 'closed'
  const [confirmId, setConfirmId] = useState(null);
  const trades = portfolio.trades.filter((t) => {
    if (filter === 'open') return t.status === 'open';
    if (filter === 'closed') return t.status !== 'open';
    return true;
  });

  return (
    <div>
      <div className="flex gap-1 mb-2">
        {['all', 'open', 'closed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 text-[10px] rounded ${
              filter === f ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
        <span className="text-[10px] text-slate-600 ml-auto">{trades.length} trades</span>
      </div>
      <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-900">
            <tr className="text-slate-500 text-left">
              <th className="px-2 py-1">Open</th>
              <th className="px-2 py-1">Close</th>
              <th className="px-2 py-1">Type</th>
              <th className="px-2 py-1">Dir</th>
              <th className="px-2 py-1 text-right">Strike</th>
              <th className="px-2 py-1 text-right">Spot@Entry</th>
              <th className="px-2 py-1 text-right">Entry $</th>
              <th className="px-2 py-1 text-right">Exit $</th>
              <th className="px-2 py-1 text-right">IV</th>
              <th className="px-2 py-1 text-right">Qty</th>
              <th className="px-2 py-1">Expiry</th>
              <th className="px-2 py-1 text-right">P&L</th>
              <th className="px-2 py-1">Status</th>
              {onDeleteTrade && <th className="px-2 py-1"></th>}
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => {
              const dir = t.direction === 'long' ? 1 : -1;
              const pnl = t.status !== 'open' && t.closePrice != null
                ? dir * (t.closePrice - t.premium) * t.quantity * 100
                : null;
              return (
                <tr key={t.id} className="border-t border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-2 py-1 text-slate-300 whitespace-nowrap">{t.openedAt?.slice(0, 10) || '—'}</td>
                  <td className="px-2 py-1 text-slate-400 whitespace-nowrap">{t.closedAt?.slice(0, 10) || '—'}</td>
                  <td className="px-2 py-1">
                    <span className={t.type === 'call' ? 'text-blue-400' : 'text-pink-400'}>
                      {t.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <span className={t.direction === 'long' ? 'text-green-400' : 'text-red-400'}>
                      {t.direction.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right font-mono">${t.strike}</td>
                  <td className="px-2 py-1 text-right font-mono text-slate-300">
                    {t.underlyingPrice != null ? `$${Number(t.underlyingPrice).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">${t.premium.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right font-mono">
                    {t.closePrice != null ? `$${t.closePrice.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-slate-400">
                    {t.iv != null ? `${(t.iv * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">{t.quantity}</td>
                  <td className="px-2 py-1 text-slate-400 whitespace-nowrap">{t.expiration?.slice(0, 10) || '—'}</td>
                  <td className={`px-2 py-1 text-right font-mono font-semibold ${
                    pnl != null ? (pnl >= 0 ? 'text-green-400' : 'text-red-400') : 'text-slate-600'
                  }`}>
                    {pnl != null ? fmtMoney(pnl) : '—'}
                  </td>
                  <td className="px-2 py-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      t.status === 'open'
                        ? 'bg-blue-500/20 text-blue-400'
                        : t.status === 'expired'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-slate-700 text-slate-400'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  {onDeleteTrade && (
                    <td className="px-2 py-1">
                      {confirmId === t.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { onDeleteTrade(portfolio.id, t.id); setConfirmId(null); }}
                            className="px-1.5 py-0.5 text-[10px] bg-red-600/80 hover:bg-red-500 rounded text-white"
                          >
                            Del
                          </button>
                          <button onClick={() => setConfirmId(null)} className="text-slate-500 hover:text-slate-300">
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(t.id)}
                          className="p-0.5 text-red-500/40 hover:text-red-400"
                          title="Delete trade"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EquityTab({ portfolio }) {
  if (portfolio.snapshots.length < 2) {
    return <div className="text-center py-6 text-slate-500 text-sm">Not enough data for equity curve.</div>;
  }

  // Thin out snapshots if too many (keep max ~200 points)
  const snaps = portfolio.snapshots;
  const step = Math.max(1, Math.floor(snaps.length / 200));
  const data = snaps.filter((_, i) => i % step === 0 || i === snaps.length - 1);

  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }}
              interval={Math.max(0, Math.floor(data.length / 6))}
            />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(v) => [`$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Portfolio Value']}
            />
            <ReferenceLine y={portfolio.config.startingCapital} stroke="#475569" strokeDasharray="4 4" />
            <Area
              type="monotone" dataKey="totalValue" stroke="#60a5fa" fill="#60a5fa"
              fillOpacity={0.1} strokeWidth={1.5}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Spot price overlay */}
      <div className="h-28 mt-2">
        <div className="text-[10px] text-slate-500 mb-1">Underlying Price</div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={false} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
              formatter={(v) => [`$${v?.toFixed(2)}`, 'Spot']}
            />
            <Line type="monotone" dataKey="spotPrice" stroke="#f59e0b" dot={false} strokeWidth={1} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
