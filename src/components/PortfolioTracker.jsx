import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Trash2, X, Pencil, Check, Briefcase, ArrowLeft } from 'lucide-react';
import { calcMetrics } from '../lib/portfolio.js';
import Button from './ui/Button.jsx';
import StatCard from './ui/StatCard.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ConfirmButton from './ui/ConfirmButton.jsx';
import { formatCurrency, formatPercent } from '../lib/format.js';

export default function PortfolioTracker({ portfolios, onDelete, onDeleteTrade, onRename, selectedId }) {
  const [detailId, setDetailId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef(null);
  const detail = portfolios.find((p) => p.id === detailId);

  useEffect(() => {
    if (renamingId && renameInputRef.current) renameInputRef.current.focus();
  }, [renamingId]);

  const startRename = (e, pf) => {
    e.stopPropagation();
    setRenamingId(pf.id);
    setRenameValue(pf.name);
  };

  const commitRename = (id) => {
    const trimmed = renameValue.trim();
    if (trimmed && onRename) onRename(id, trimmed);
    setRenamingId(null);
  };

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

    const maxDrawdown = Math.max(0, ...allMetrics.map((m) => m.maxDrawdown));

    const sorted = [...portfolios].map((pf, i) => ({ pf, pnl: allMetrics[i].totalPnl }));
    sorted.sort((a, b) => b.pnl - a.pnl);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

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
    return <PortfolioDetail portfolio={detail} onBack={() => setDetailId(null)} onRename={onRename} onDeleteTrade={onDeleteTrade} />;
  }

  const signFor = (n) => (n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral');

  return (
    <div className="space-y-3">
      {portfolios.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="No portfolios yet"
          helper="Run a backtest or start forward testing to create one."
        />
      )}

      {/* Aggregate Summary */}
      {aggregate && (
        <div className="bg-[#111827] rounded-lg border border-slate-800 p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">
            Summary — {aggregate.count} Portfolio{aggregate.count !== 1 ? 's' : ''}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard label="Total P&L" value={formatCurrency(aggregate.totalPnl)} sign={signFor(aggregate.totalPnl)} />
            <StatCard
              label="Return"
              value={`${aggregate.returnPct >= 0 ? '+' : ''}${formatPercent(aggregate.returnPct)}`}
              sign={signFor(aggregate.returnPct)}
            />
            <StatCard label="Win Rate" value={formatPercent(aggregate.winRate)} />
            <StatCard label="Total Trades" value={aggregate.totalTrades} />
            <StatCard
              label="Profit Factor"
              value={aggregate.profitFactor === Infinity ? '∞' : aggregate.profitFactor.toFixed(2)}
            />
            <StatCard label="Max Drawdown" value={formatPercent(aggregate.maxDrawdown)} sign="negative" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-800">
            <StatCard size="sm" label="Total Capital" value={formatCurrency(aggregate.totalCapital)} />
            <StatCard size="sm" label="Ending Value" value={formatCurrency(aggregate.totalEnding)} />
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">W / L</div>
              <div className="text-sm font-mono font-semibold">
                <span className="text-green-400">{aggregate.totalWinners}</span>
                <span className="text-slate-600"> / </span>
                <span className="text-red-400">{aggregate.totalLosers}</span>
              </div>
            </div>
            {aggregate.count > 1 && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Best / Worst</div>
                <div className="text-sm font-mono font-semibold">
                  <span className="text-green-400">{formatCurrency(aggregate.best.pnl)}</span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-red-400">{formatCurrency(aggregate.worst.pnl)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {portfolios.map((pf) => {
        const metrics = calcMetrics(pf);
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
              <div className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  pf.mode === 'backtest'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {pf.mode === 'backtest' ? 'BACKTEST' : 'FORWARD'}
                </span>
                {renamingId === pf.id ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(pf.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(pf.id);
                      if (e.key === 'Escape') setRenamingId(null);
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-medium bg-slate-800 border border-blue-500 rounded px-1.5 py-0.5 text-slate-200 w-40 min-w-0"
                    aria-label="Portfolio name"
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-200 truncate">{pf.name}</span>
                )}
                {pf.symbol && <span className="text-xs text-slate-500 shrink-0">{pf.symbol}</span>}
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {renamingId === pf.id ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    iconOnly
                    icon={Check}
                    aria-label="Save name"
                    onClick={() => commitRename(pf.id)}
                    className="!text-green-400 hover:!text-green-300"
                  />
                ) : (
                  <Button
                    variant="ghost"
                    size="xs"
                    iconOnly
                    icon={Pencil}
                    aria-label="Rename portfolio"
                    onClick={(e) => startRename(e, pf)}
                    className="!text-slate-500 hover:!text-slate-300"
                  />
                )}
                <ConfirmButton
                  onConfirm={() => onDelete(pf.id)}
                  ariaLabel={`Delete portfolio ${pf.name}`}
                  confirmLabel="Delete"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 text-xs">
              <StatCard size="sm" label="Total P&L" value={formatCurrency(metrics.totalPnl)} sign={signFor(metrics.totalPnl)} />
              <StatCard size="sm" label="Win Rate" value={formatPercent(metrics.winRate)} />
              <StatCard size="sm" label="Trades" value={metrics.totalTrades} />
              <StatCard
                size="sm"
                label="Profit Factor"
                value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
              />
            </div>
            {pf.snapshots.length > 1 && (
              <div className="mt-2 h-12" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={pf.snapshots}>
                    <Line
                      type="monotone" dataKey="totalValue" stroke="#60a5fa"
                      dot={false} strokeWidth={1.5} isAnimationActive={false}
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

function PortfolioDetail({ portfolio, onBack, onRename, onDeleteTrade }) {
  const [tab, setTab] = useState('overview');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef(null);
  const metrics = calcMetrics(portfolio);

  useEffect(() => {
    if (renaming && renameRef.current) renameRef.current.focus();
  }, [renaming]);

  const startRename = () => { setRenaming(true); setRenameValue(portfolio.name); };
  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && onRename) onRename(portfolio.id, trimmed);
    setRenaming(false);
  };

  return (
    <div>
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="mb-3">
        Back to portfolios
      </Button>

      <div className="flex items-center gap-2 mb-3">
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
          portfolio.mode === 'backtest'
            ? 'bg-purple-500/20 text-purple-400'
            : 'bg-emerald-500/20 text-emerald-400'
        }`}>
          {portfolio.mode === 'backtest' ? 'BACKTEST' : 'FORWARD'}
        </span>
        {renaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            className="text-sm font-semibold bg-slate-800 border border-blue-500 rounded px-1.5 py-0.5 text-slate-200 w-48"
            aria-label="Portfolio name"
          />
        ) : (
          <h3 className="text-sm font-semibold text-slate-200">{portfolio.name}</h3>
        )}
        {portfolio.symbol && <span className="text-xs text-slate-500">{portfolio.symbol}</span>}
        {renaming ? (
          <Button variant="ghost" size="xs" iconOnly icon={Check} aria-label="Save name" onClick={commitRename}
            className="!text-green-400 hover:!text-green-300" />
        ) : (
          <Button variant="ghost" size="xs" iconOnly icon={Pencil} aria-label="Rename portfolio" onClick={startRename}
            className="!text-slate-500 hover:!text-slate-300" />
        )}
      </div>

      {/* Tab nav */}
      <div className="flex gap-0 mb-3 border-b border-slate-800" role="tablist" aria-label="Portfolio views">
        {['overview', 'trades', 'equity'].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            aria-controls={`portfolio-panel-${t}`}
            id={`portfolio-tab-${t}`}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:text-blue-400 ${
              tab === t
                ? 'text-blue-400 border-blue-500'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`portfolio-panel-${tab}`}
        aria-labelledby={`portfolio-tab-${tab}`}
      >
        {tab === 'overview' && <OverviewTab metrics={metrics} portfolio={portfolio} />}
        {tab === 'trades' && <TradesTab portfolio={portfolio} onDeleteTrade={onDeleteTrade} />}
        {tab === 'equity' && <EquityTab portfolio={portfolio} />}
      </div>
    </div>
  );
}

function OverviewTab({ metrics, portfolio }) {
  const signFor = (n) => (n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral');
  const endingValue = portfolio.snapshots.length > 0
    ? portfolio.snapshots[portfolio.snapshots.length - 1].totalValue
    : portfolio.config.startingCapital;

  const stats = [
    { label: 'Total P&L', value: formatCurrency(metrics.totalPnl), sign: signFor(metrics.totalPnl) },
    { label: 'Win Rate', value: formatPercent(metrics.winRate), sign: 'neutral' },
    { label: 'Winners', value: metrics.winners, sign: 'positive' },
    { label: 'Losers', value: metrics.losers, sign: 'negative' },
    { label: 'Avg Win', value: formatCurrency(metrics.avgWin), sign: 'positive' },
    { label: 'Avg Loss', value: formatCurrency(metrics.avgLoss), sign: 'negative' },
    { label: 'Profit Factor', value: metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2), sign: 'neutral' },
    { label: 'Max Drawdown', value: formatPercent(metrics.maxDrawdown), sign: 'negative' },
    { label: 'Sharpe Ratio', value: metrics.sharpe.toFixed(2), sign: 'neutral' },
    { label: 'Total Trades', value: metrics.totalTrades, sign: 'neutral' },
    { label: 'Starting Capital', value: formatCurrency(portfolio.config.startingCapital), sign: 'neutral' },
    { label: 'Ending Value', value: formatCurrency(endingValue), sign: 'neutral' },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-slate-800/50 rounded p-2">
          <StatCard label={s.label} value={s.value} sign={s.sign} />
        </div>
      ))}
    </div>
  );
}

function TradesTab({ portfolio, onDeleteTrade }) {
  const [filter, setFilter] = useState('all');
  const trades = portfolio.trades.filter((t) => {
    if (filter === 'open') return t.status === 'open';
    if (filter === 'closed') return t.status !== 'open';
    return true;
  });

  return (
    <div>
      <div className="flex gap-1 mb-2" role="group" aria-label="Filter trades by status">
        {['all', 'open', 'closed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`px-2 py-0.5 text-[10px] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
              filter === f ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
        <span className="text-[10px] text-slate-600 ml-auto">{trades.length} trades</span>
      </div>
      <div className="overflow-x-auto max-h-[320px] overflow-y-auto rounded-lg border border-slate-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 text-left bg-slate-900">
              <th className="px-2 py-1.5 sticky-th">Ticker</th>
              <th className="px-2 py-1.5 sticky-th">Open</th>
              <th className="px-2 py-1.5 sticky-th">Close</th>
              <th className="px-2 py-1.5 sticky-th">Type</th>
              <th className="px-2 py-1.5 sticky-th">Dir</th>
              <th className="px-2 py-1.5 text-right sticky-th">Strike</th>
              <th className="px-2 py-1.5 text-right sticky-th">Spot@Entry</th>
              <th className="px-2 py-1.5 text-right sticky-th">Entry $</th>
              <th className="px-2 py-1.5 text-right sticky-th">Exit $</th>
              <th className="px-2 py-1.5 text-right sticky-th">IV</th>
              <th className="px-2 py-1.5 text-right sticky-th">Qty</th>
              <th className="px-2 py-1.5 sticky-th">Expiry</th>
              <th className="px-2 py-1.5 text-right sticky-th">P&L</th>
              <th className="px-2 py-1.5 sticky-th">Status</th>
              {onDeleteTrade && <th className="px-2 py-1.5 sticky-th"></th>}
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
                  <td className="px-2 py-1.5 font-mono font-semibold text-slate-300 whitespace-nowrap">
                    {t.symbol || '—'}
                  </td>
                  <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">{t.openedAt?.slice(0, 10) || '—'}</td>
                  <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">{t.closedAt?.slice(0, 10) || '—'}</td>
                  <td className="px-2 py-1.5">
                    <span className={t.type === 'call' ? 'text-blue-400' : 'text-pink-400'}>
                      {t.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={t.direction === 'long' ? 'text-green-400' : 'text-red-400'}>
                      {t.direction.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">${t.strike}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-300">
                    {t.underlyingPrice != null ? formatCurrency(t.underlyingPrice) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(t.premium)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {t.closePrice != null ? formatCurrency(t.closePrice) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-400">
                    {t.iv != null ? `${(t.iv * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{t.quantity}</td>
                  <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">{t.expiration?.slice(0, 10) || '—'}</td>
                  <td className={`px-2 py-1.5 text-right font-mono font-semibold ${
                    pnl != null ? (pnl >= 0 ? 'text-green-400' : 'text-red-400') : 'text-slate-600'
                  }`}>
                    {pnl != null ? formatCurrency(pnl) : '—'}
                  </td>
                  <td className="px-2 py-1.5">
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
                    <td className="px-2 py-1.5">
                      <ConfirmButton
                        onConfirm={() => onDeleteTrade(portfolio.id, t.id)}
                        ariaLabel="Delete trade"
                        confirmLabel="Del"
                      />
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
    return (
      <EmptyState
        title="Not enough data for equity curve"
        helper="Take at least two snapshots (or run a full backtest) to see the equity curve here."
        size="sm"
      />
    );
  }

  const snaps = portfolio.snapshots;
  const step = Math.max(1, Math.floor(snaps.length / 200));
  const data = snaps.filter((_, i) => i % step === 0 || i === snaps.length - 1);

  return (
    <div>
      <div className="flex items-center gap-3 mb-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-0.5 bg-[#60a5fa]" /> Portfolio value</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-px bg-[#475569] border-t border-dashed border-[#475569]" /> Starting capital</span>
      </div>
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
              formatter={(v) => [formatCurrency(v, { decimals: 0 }), 'Portfolio Value']}
            />
            <ReferenceLine y={portfolio.config.startingCapital} stroke="#475569" strokeDasharray="4 4" />
            <Area
              type="monotone" dataKey="totalValue" stroke="#60a5fa" fill="#60a5fa"
              fillOpacity={0.1} strokeWidth={1.5} isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="h-28 mt-2">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Underlying Price</div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={false} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
              formatter={(v) => [formatCurrency(v), 'Spot']}
            />
            <Line type="monotone" dataKey="spotPrice" stroke="#f59e0b" dot={false} strokeWidth={1} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
