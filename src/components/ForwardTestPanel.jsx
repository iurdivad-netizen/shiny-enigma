import { useState, useCallback } from 'react';
import { Plus, X, Camera, AlertTriangle, Download, Trash2 } from 'lucide-react';
import {
  createPortfolio, createTrade, addTrade, closeTrade,
  expireTrade, deleteTrade, takeSnapshot, savePortfolios, makeGroupId,
} from '../lib/portfolio.js';

export default function ForwardTestPanel({ portfolios, setPortfolios, underlyingPrice, symbol, currentLegs, daysToExpiry }) {
  const [activePortfolioId, setActivePortfolioId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCapital, setNewCapital] = useState(10000);

  // Trade entry form
  const [tradeType, setTradeType] = useState('call');
  const [tradeDir, setTradeDir] = useState('long');
  const [tradeStrike, setTradeStrike] = useState(Math.round(underlyingPrice));
  const [tradePremium, setTradePremium] = useState(0);
  const [tradeQty, setTradeQty] = useState(1);
  const [tradeIv, setTradeIv] = useState(30);
  const [tradeDte, setTradeDte] = useState(30);
  const [tradeNotes, setTradeNotes] = useState('');
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);

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
  }, [newName, newCapital, symbol, portfolios, setPortfolios]);

  const logTrade = useCallback(() => {
    if (!activePf) return;
    setError('');

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
  }, [activePf, tradeType, tradeDir, tradeStrike, tradePremium, tradeQty, tradeIv, tradeDte, tradeNotes, underlyingPrice, symbol, portfolios, setPortfolios]);

  const closeTradeHandler = useCallback((tradeId) => {
    if (!activePf) return;
    const closePrice = parseFloat(prompt('Enter close price per share:'));
    if (isNaN(closePrice)) return;
    const updated = portfolios.map((p) =>
      p.id === activePf.id ? closeTrade(p, tradeId, closePrice) : p
    );
    setPortfolios(updated);
    savePortfolios(updated);
  }, [activePf, portfolios, setPortfolios]);

  const expireTradeHandler = useCallback((tradeId) => {
    if (!activePf) return;
    const updated = portfolios.map((p) =>
      p.id === activePf.id ? expireTrade(p, tradeId, underlyingPrice) : p
    );
    setPortfolios(updated);
    savePortfolios(updated);
  }, [activePf, underlyingPrice, portfolios, setPortfolios]);

  const deleteTradeHandler = useCallback((tradeId) => {
    if (!activePf) return;
    const updated = portfolios.map((p) =>
      p.id === activePf.id ? deleteTrade(p, tradeId) : p
    );
    setPortfolios(updated);
    savePortfolios(updated);
  }, [activePf, portfolios, setPortfolios]);

  const snap = useCallback(() => {
    if (!activePf) return;
    const updated = portfolios.map((p) =>
      p.id === activePf.id ? takeSnapshot(p, underlyingPrice) : p
    );
    setPortfolios(updated);
    savePortfolios(updated);
  }, [activePf, underlyingPrice, portfolios, setPortfolios]);

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
  }, [activePf, currentLegs, daysToExpiry, symbol, underlyingPrice, portfolios, setPortfolios]);

  return (
    <div className="space-y-3">
      {/* Portfolio selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={activePortfolioId || ''}
          onChange={(e) => setActivePortfolioId(e.target.value || null)}
          className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 text-xs"
        >
          <option value="">Select portfolio...</option>
          {forwardPortfolios.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.trades.length} trades)</option>
          ))}
        </select>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-500 rounded font-medium"
        >
          <Plus size={12} /> New Portfolio
        </button>
        {activePf && (
          <button
            onClick={snap}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded font-medium"
          >
            <Camera size={12} /> Snapshot
          </button>
        )}
        {activePf && currentLegs && currentLegs.length > 0 && (
          <button
            onClick={importFromSimulator}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 rounded font-medium"
            title={`Import ${currentLegs.length} leg(s) from the simulator as trades`}
          >
            <Download size={12} /> Import from Simulator ({currentLegs.length})
          </button>
        )}
      </div>

      {/* New portfolio form */}
      {showNewForm && (
        <div className="bg-slate-800/50 rounded p-3 flex items-end gap-2 text-xs">
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Name</span>
            <input
              type="text" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-2 py-1 rounded" placeholder="My Forward Test"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Starting Capital $</span>
            <input
              type="number" value={newCapital}
              onChange={(e) => setNewCapital(+e.target.value || 10000)}
              className="px-2 py-1 rounded w-24" min="100"
            />
          </label>
          <button
            onClick={createNew}
            className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded font-medium"
          >
            Create
          </button>
          <button onClick={() => setShowNewForm(false)} className="p-1 text-slate-500 hover:text-slate-300">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Trade entry form */}
      {activePf && (
        <div className="border border-slate-700 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-300">Log New Trade</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">Type</span>
              <select value={tradeType} onChange={(e) => setTradeType(e.target.value)}
                className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">
                <option value="call">Call</option>
                <option value="put">Put</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">Direction</span>
              <select value={tradeDir} onChange={(e) => setTradeDir(e.target.value)}
                className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">Strike</span>
              <input type="number" value={tradeStrike} onChange={(e) => setTradeStrike(+e.target.value || 0)}
                className="px-2 py-1 rounded" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">Premium $</span>
              <input type="number" value={tradePremium} onChange={(e) => setTradePremium(+e.target.value || 0)}
                className="px-2 py-1 rounded" step="0.01" min="0" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">Qty</span>
              <input type="number" value={tradeQty} onChange={(e) => setTradeQty(Math.max(1, +e.target.value || 1))}
                className="px-2 py-1 rounded" min="1" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">IV %</span>
              <input type="number" value={tradeIv} onChange={(e) => setTradeIv(+e.target.value || 30)}
                className="px-2 py-1 rounded" min="1" max="200" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">DTE</span>
              <input type="number" value={tradeDte} onChange={(e) => setTradeDte(+e.target.value || 30)}
                className="px-2 py-1 rounded" min="1" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">Notes</span>
              <input type="text" value={tradeNotes} onChange={(e) => setTradeNotes(e.target.value)}
                className="px-2 py-1 rounded" placeholder="Optional" />
            </label>
          </div>
          <button
            onClick={logTrade}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium"
          >
            <Plus size={12} /> Log Trade
          </button>
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle size={12} /> {error}
            </div>
          )}
        </div>
      )}

      {/* Open positions */}
      {activePf && activePf.trades.filter((t) => t.status === 'open').length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-400 mb-1">Open Positions</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-left">
                  <th className="px-2 py-1">Type</th>
                  <th className="px-2 py-1">Dir</th>
                  <th className="px-2 py-1 text-right">Strike</th>
                  <th className="px-2 py-1 text-right">Entry</th>
                  <th className="px-2 py-1 text-right">Qty</th>
                  <th className="px-2 py-1">Exp</th>
                  <th className="px-2 py-1">Notes</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {activePf.trades.filter((t) => t.status === 'open').map((t) => (
                  <tr key={t.id} className="border-t border-slate-800/50">
                    <td className="px-2 py-1">
                      <span className={t.type === 'call' ? 'text-blue-400' : 'text-pink-400'}>{t.type.toUpperCase()}</span>
                    </td>
                    <td className="px-2 py-1">
                      <span className={t.direction === 'long' ? 'text-green-400' : 'text-red-400'}>{t.direction.toUpperCase()}</span>
                    </td>
                    <td className="px-2 py-1 text-right font-mono">${t.strike}</td>
                    <td className="px-2 py-1 text-right font-mono">${t.premium.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right font-mono">{t.quantity}</td>
                    <td className="px-2 py-1 text-slate-400">{t.expiration}</td>
                    <td className="px-2 py-1 text-slate-500 max-w-[100px] truncate">{t.notes}</td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1 items-center">
                        <button
                          onClick={() => closeTradeHandler(t.id)}
                          className="px-1.5 py-0.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded"
                        >
                          Close
                        </button>
                        <button
                          onClick={() => expireTradeHandler(t.id)}
                          className="px-1.5 py-0.5 text-[10px] bg-yellow-700/50 hover:bg-yellow-600/50 rounded text-yellow-300"
                        >
                          Expire
                        </button>
                        {confirmId === t.id ? (
                          <>
                            <button
                              onClick={() => { deleteTradeHandler(t.id); setConfirmId(null); }}
                              className="px-1.5 py-0.5 text-[10px] bg-red-600/80 hover:bg-red-500 rounded text-white"
                            >
                              Del
                            </button>
                            <button onClick={() => setConfirmId(null)} className="text-slate-500 hover:text-slate-300">
                              <X size={11} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmId(t.id)}
                            className="p-0.5 text-red-500/40 hover:text-red-400"
                            title="Delete trade"
                          >
                            <Trash2 size={11} />
                          </button>
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
        <div className="text-center py-6 text-slate-500 text-sm">
          Create a portfolio to start paper trading. Log trades manually,
          take snapshots to track equity over time.
        </div>
      )}
    </div>
  );
}
