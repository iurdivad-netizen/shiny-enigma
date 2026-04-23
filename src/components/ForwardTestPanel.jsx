import { useState, useCallback, useId } from 'react';
import { Plus, X, Camera, Download, Briefcase, Check } from 'lucide-react';
import {
  createPortfolio, createTrade, addTrade, closeTrade,
  expireTrade, deleteTrade, takeSnapshot, savePortfolios, makeGroupId,
} from '../lib/portfolio.js';
import Button from './ui/Button.jsx';
import ErrorBox from './ui/ErrorBox.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ConfirmButton from './ui/ConfirmButton.jsx';
import { formatCurrency } from '../lib/format.js';
import { useToast } from './ui/Toast.jsx';

export default function ForwardTestPanel({ portfolios, setPortfolios, underlyingPrice, symbol, currentLegs, daysToExpiry }) {
  const toast = useToast();
  const [activePortfolioId, setActivePortfolioId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCapital, setNewCapital] = useState(10000);

  const [tradeType, setTradeType] = useState('call');
  const [tradeDir, setTradeDir] = useState('long');
  const [tradeStrike, setTradeStrike] = useState(Math.round(underlyingPrice));
  const [tradePremium, setTradePremium] = useState(0);
  const [tradeQty, setTradeQty] = useState(1);
  const [tradeIv, setTradeIv] = useState(30);
  const [tradeDte, setTradeDte] = useState(30);
  const [tradeNotes, setTradeNotes] = useState('');
  const [error, setError] = useState('');
  const [closingTradeId, setClosingTradeId] = useState(null);
  const [closePriceInput, setClosePriceInput] = useState('');

  const labelIds = {
    type: useId(), dir: useId(), strike: useId(), premium: useId(),
    qty: useId(), iv: useId(), dte: useId(), notes: useId(),
    name: useId(), capital: useId(),
  };

  const forwardPortfolios = portfolios.filter((p) => p.mode === 'forward');
  const activePf = portfolios.find((p) => p.id === activePortfolioId);

  const createNew = useCallback(() => {
    if (!newName.trim()) return;
    const pf = createPortfolio({ name: newName.trim(), mode: 'forward', symbol: symbol || '' });
    pf.config.startingCapital = newCapital;
    const updated = [...portfolios, pf];
    setPortfolios(updated);
    savePortfolios(updated);
    setActivePortfolioId(pf.id);
    setShowNewForm(false);
    setNewName('');
    toast.show(`Portfolio "${pf.name}" created`, { intent: 'success' });
  }, [newName, newCapital, symbol, portfolios, setPortfolios, toast]);

  const logTrade = useCallback(() => {
    if (!activePf) return;
    setError('');
    if (tradeStrike <= 0) { setError('Strike must be greater than 0.'); return; }
    if (tradePremium < 0) { setError('Premium cannot be negative.'); return; }

    const expDate = new Date();
    expDate.setDate(expDate.getDate() + tradeDte);

    const trade = createTrade({
      symbol: symbol || activePf.symbol || 'UNKNOWN',
      type: tradeType,
      direction: tradeDir,
      strike: tradeStrike,
      premium: tradePremium,
      quantity: tradeQty,
      iv: tradeIv / 100,
      underlyingPrice,
      expiration: expDate.toISOString().slice(0, 10),
      notes: tradeNotes,
    });

    const updated = portfolios.map((p) =>
      p.id === activePf.id ? addTrade(p, trade) : p
    );
    setPortfolios(updated);
    savePortfolios(updated);
    setTradeNotes('');
    toast.show(`${tradeDir.toUpperCase()} ${tradeType.toUpperCase()} ${tradeStrike} logged`, { intent: 'success' });
  }, [activePf, tradeType, tradeDir, tradeStrike, tradePremium, tradeQty, tradeIv, tradeDte, tradeNotes, underlyingPrice, symbol, portfolios, setPortfolios, toast]);

  const beginClose = (tradeId) => {
    setClosingTradeId(tradeId);
    setClosePriceInput('');
  };

  const confirmClose = useCallback(() => {
    if (!activePf || !closingTradeId) return;
    const closePrice = parseFloat(closePriceInput);
    if (isNaN(closePrice) || closePrice < 0) return;
    const updated = portfolios.map((p) =>
      p.id === activePf.id ? closeTrade(p, closingTradeId, closePrice, null, underlyingPrice) : p
    );
    setPortfolios(updated);
    savePortfolios(updated);
    setClosingTradeId(null);
    setClosePriceInput('');
    toast.show('Trade closed', { intent: 'success' });
  }, [activePf, closingTradeId, closePriceInput, underlyingPrice, portfolios, setPortfolios, toast]);

  const expireTradeHandler = useCallback((tradeId) => {
    if (!activePf) return;
    const updated = portfolios.map((p) =>
      p.id === activePf.id ? expireTrade(p, tradeId, underlyingPrice) : p
    );
    setPortfolios(updated);
    savePortfolios(updated);
    toast.show('Trade expired', { intent: 'info' });
  }, [activePf, underlyingPrice, portfolios, setPortfolios, toast]);

  const deleteTradeHandler = useCallback((tradeId) => {
    if (!activePf) return;
    const updated = portfolios.map((p) =>
      p.id === activePf.id ? deleteTrade(p, tradeId) : p
    );
    setPortfolios(updated);
    savePortfolios(updated);
    toast.show('Trade deleted', { intent: 'info' });
  }, [activePf, portfolios, setPortfolios, toast]);

  const snap = useCallback(() => {
    if (!activePf) return;
    const updated = portfolios.map((p) =>
      p.id === activePf.id ? takeSnapshot(p, underlyingPrice) : p
    );
    setPortfolios(updated);
    savePortfolios(updated);
    toast.show(`Snapshot taken @ ${formatCurrency(underlyingPrice)}`, { intent: 'success' });
  }, [activePf, underlyingPrice, portfolios, setPortfolios, toast]);

  const importFromSimulator = useCallback(() => {
    if (!activePf || !currentLegs || currentLegs.length === 0) return;
    let pf = portfolios.find((p) => p.id === activePf.id);
    if (!pf) return;
    const gid = makeGroupId();
    for (const leg of currentLegs) {
      const expDate = new Date();
      const dte = leg.dte ?? daysToExpiry ?? 30;
      expDate.setDate(expDate.getDate() + dte);
      const trade = createTrade({
        symbol: symbol || activePf.symbol || 'UNKNOWN',
        type: leg.type,
        direction: leg.direction,
        strike: leg.strike,
        premium: leg.premium || 0,
        quantity: leg.quantity || 1,
        iv: leg.iv || 0.30,
        underlyingPrice,
        expiration: expDate.toISOString().slice(0, 10),
        notes: 'Imported from simulator',
        groupId: gid,
      });
      pf = addTrade(pf, trade);
    }
    const updated = portfolios.map((p) => (p.id === activePf.id ? pf : p));
    setPortfolios(updated);
    savePortfolios(updated);
    toast.show(`Imported ${currentLegs.length} leg(s) from simulator`, { intent: 'success' });
  }, [activePf, currentLegs, daysToExpiry, symbol, underlyingPrice, portfolios, setPortfolios, toast]);

  return (
    <div className="space-y-3">
      {/* Portfolio selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={activePortfolioId || ''}
          onChange={(e) => setActivePortfolioId(e.target.value || null)}
          className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 text-xs"
          aria-label="Select forward-test portfolio"
        >
          <option value="">Select portfolio...</option>
          {forwardPortfolios.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.trades.length} trades)</option>
          ))}
        </select>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowNewForm(!showNewForm)}>
          New Portfolio
        </Button>
        {activePf && (
          <Button variant="secondary" size="sm" icon={Camera} onClick={snap}>
            Snapshot
          </Button>
        )}
        {activePf && currentLegs && currentLegs.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            icon={Download}
            onClick={importFromSimulator}
            title={`Import ${currentLegs.length} leg(s) from the simulator as trades`}
            className="!bg-blue-600/20 !text-blue-400 !border-blue-500/30 hover:!bg-blue-600/30"
          >
            Import from Simulator ({currentLegs.length})
          </Button>
        )}
      </div>

      {/* New portfolio form */}
      {showNewForm && (
        <div className="bg-slate-800/50 rounded-lg p-3 flex items-end gap-2 text-xs flex-wrap">
          <label htmlFor={labelIds.name} className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Name</span>
            <input
              id={labelIds.name}
              type="text" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-2 py-1 rounded" placeholder="My Forward Test"
            />
          </label>
          <label htmlFor={labelIds.capital} className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Starting Capital $</span>
            <input
              id={labelIds.capital}
              type="number" value={newCapital}
              onChange={(e) => setNewCapital(+e.target.value || 10000)}
              className="px-2 py-1 rounded w-24" min="100" step="100"
            />
          </label>
          <Button variant="primary" size="sm" onClick={createNew} disabled={!newName.trim()}>
            Create
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={X}
            aria-label="Cancel creating portfolio"
            onClick={() => setShowNewForm(false)}
          />
        </div>
      )}

      {/* Trade entry form */}
      {activePf && (
        <div className="border border-slate-700 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Log New Trade</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <label htmlFor={labelIds.type} className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Type</span>
              <select id={labelIds.type} value={tradeType} onChange={(e) => setTradeType(e.target.value)}
                className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">
                <option value="call">Call</option>
                <option value="put">Put</option>
              </select>
            </label>
            <label htmlFor={labelIds.dir} className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Direction</span>
              <select id={labelIds.dir} value={tradeDir} onChange={(e) => setTradeDir(e.target.value)}
                className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </label>
            <label htmlFor={labelIds.strike} className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Strike</span>
              <input id={labelIds.strike} type="number" value={tradeStrike} onChange={(e) => setTradeStrike(+e.target.value || 0)}
                className="px-2 py-1 rounded" min="0.01" step="0.5" />
            </label>
            <label htmlFor={labelIds.premium} className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Premium $</span>
              <input id={labelIds.premium} type="number" value={tradePremium} onChange={(e) => setTradePremium(+e.target.value || 0)}
                className="px-2 py-1 rounded" step="0.01" min="0" />
            </label>
            <label htmlFor={labelIds.qty} className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Qty</span>
              <input id={labelIds.qty} type="number" value={tradeQty} onChange={(e) => setTradeQty(Math.max(1, +e.target.value || 1))}
                className="px-2 py-1 rounded" min="1" step="1" />
            </label>
            <label htmlFor={labelIds.iv} className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">IV %</span>
              <input id={labelIds.iv} type="number" value={tradeIv} onChange={(e) => setTradeIv(+e.target.value || 30)}
                className="px-2 py-1 rounded" min="1" max="300" step="0.5" />
            </label>
            <label htmlFor={labelIds.dte} className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">DTE (days)</span>
              <input id={labelIds.dte} type="number" value={tradeDte} onChange={(e) => setTradeDte(+e.target.value || 30)}
                className="px-2 py-1 rounded" min="1" step="1" />
            </label>
            <label htmlFor={labelIds.notes} className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Notes</span>
              <input id={labelIds.notes} type="text" value={tradeNotes} onChange={(e) => setTradeNotes(e.target.value)}
                className="px-2 py-1 rounded" placeholder="Optional" />
            </label>
          </div>
          <Button variant="primary" size="md" icon={Plus} onClick={logTrade}>
            Log Trade
          </Button>
          {error && (
            <ErrorBox intent="error" compact>{error}</ErrorBox>
          )}
        </div>
      )}

      {/* Open positions */}
      {activePf && activePf.trades.filter((t) => t.status === 'open').length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Open Positions</div>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-left bg-slate-900">
                  <th className="px-2 py-1.5 sticky-th">Type</th>
                  <th className="px-2 py-1.5 sticky-th">Dir</th>
                  <th className="px-2 py-1.5 text-right sticky-th">Strike</th>
                  <th className="px-2 py-1.5 text-right sticky-th">Entry</th>
                  <th className="px-2 py-1.5 text-right sticky-th">Qty</th>
                  <th className="px-2 py-1.5 sticky-th">Exp</th>
                  <th className="px-2 py-1.5 sticky-th">Notes</th>
                  <th className="px-2 py-1.5 sticky-th"></th>
                </tr>
              </thead>
              <tbody>
                {activePf.trades.filter((t) => t.status === 'open').map((t) => (
                  <tr key={t.id} className="border-t border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-2 py-1.5">
                      <span className={t.type === 'call' ? 'text-blue-400' : 'text-pink-400'}>{t.type.toUpperCase()}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={t.direction === 'long' ? 'text-green-400' : 'text-red-400'}>{t.direction.toUpperCase()}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">${t.strike}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(t.premium)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{t.quantity}</td>
                    <td className="px-2 py-1.5 text-slate-400">{t.expiration}</td>
                    <td className="px-2 py-1.5 text-slate-500 max-w-[100px] truncate" title={t.notes}>{t.notes}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1 items-center">
                        {closingTradeId === t.id ? (
                          <>
                            <input
                              type="number"
                              value={closePriceInput}
                              onChange={(e) => setClosePriceInput(e.target.value)}
                              placeholder="Close $"
                              step="0.01"
                              min="0"
                              autoFocus
                              className="px-1.5 py-0.5 rounded w-20 text-[10px]"
                              aria-label="Close price per share"
                              onKeyDown={(e) => { if (e.key === 'Enter') confirmClose(); if (e.key === 'Escape') setClosingTradeId(null); }}
                            />
                            <Button
                              variant="primary"
                              size="xs"
                              iconOnly
                              icon={Check}
                              aria-label="Confirm close price"
                              onClick={confirmClose}
                              disabled={!closePriceInput || isNaN(parseFloat(closePriceInput))}
                            />
                            <Button
                              variant="ghost"
                              size="xs"
                              iconOnly
                              icon={X}
                              aria-label="Cancel closing trade"
                              onClick={() => setClosingTradeId(null)}
                            />
                          </>
                        ) : (
                          <>
                            <Button variant="secondary" size="xs" onClick={() => beginClose(t.id)}>Close</Button>
                            <ConfirmButton
                              triggerLabel="Expire"
                              triggerVariant="secondary"
                              triggerClassName="!bg-yellow-900/30 !text-yellow-400 !border-yellow-800/50 hover:!bg-yellow-900/50"
                              confirmLabel="Confirm Expire"
                              ariaLabel="Expire trade at current spot"
                              variant="danger"
                              size="xs"
                              onConfirm={() => expireTradeHandler(t.id)}
                            />
                            <ConfirmButton
                              onConfirm={() => deleteTradeHandler(t.id)}
                              ariaLabel="Delete trade"
                              confirmLabel="Del"
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info */}
      {!activePf && forwardPortfolios.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="No forward-test portfolios yet"
          helper="Create a portfolio to start paper trading. Log trades manually or import legs from the simulator, then take snapshots to track equity over time."
        />
      )}
    </div>
  );
}
