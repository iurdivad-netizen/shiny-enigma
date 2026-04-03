import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Settings, Key, X, Loader2, ChevronDown, AlertCircle, ExternalLink, RefreshCw,
} from 'lucide-react';
import {
  getStoredToken, setStoredToken, clearStoredToken,
  fetchQuote, fetchExpirations, fetchChain, parseChainByStrike,
} from '../lib/tradierApi.js';

/**
 * Options chain panel with API token management, ticker search,
 * expiration selector, and clickable chain table.
 *
 * Props:
 *   onAddLeg(leg)      — callback when user clicks a chain row to add a leg
 *   onQuoteLoaded(quote) — callback with quote data (last price, description)
 *   onDteLoaded(dte)    — callback with DTE for selected expiration
 */
export default function OptionsChain({ onAddLeg, onQuoteLoaded, onDteLoaded }) {
  const [token, setToken] = useState(getStoredToken);
  const [tokenInput, setTokenInput] = useState(token);
  const [showSettings, setShowSettings] = useState(!token);

  const [ticker, setTicker] = useState('');
  const [tickerInput, setTickerInput] = useState('');
  const [quote, setQuote] = useState(null);

  const [expirations, setExpirations] = useState([]);
  const [selectedExp, setSelectedExp] = useState('');
  const [chain, setChain] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Persist token
  const saveToken = useCallback(() => {
    const t = tokenInput.trim();
    setToken(t);
    setStoredToken(t);
    if (t) setShowSettings(false);
  }, [tokenInput]);

  const removeToken = useCallback(() => {
    setToken('');
    setTokenInput('');
    clearStoredToken();
    setShowSettings(true);
    setQuote(null);
    setChain([]);
    setExpirations([]);
    setTicker('');
  }, []);

  // Fetch quote + expirations
  const loadTicker = useCallback(async () => {
    const sym = tickerInput.trim().toUpperCase();
    if (!sym || !token) return;
    setLoading(true);
    setError('');
    setChain([]);
    setExpirations([]);
    setSelectedExp('');
    try {
      const [q, exps] = await Promise.all([
        fetchQuote(sym, token),
        fetchExpirations(sym, token),
      ]);
      setTicker(sym);
      setQuote(q);
      setExpirations(exps);
      if (exps.length > 0) setSelectedExp(exps[0]);
      if (onQuoteLoaded && q) {
        onQuoteLoaded({
          symbol: sym,
          last: q.last,
          description: q.description,
          change: q.change,
          changePct: q.change_percentage,
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [tickerInput, token, onQuoteLoaded]);

  // Fetch chain when expiration changes
  useEffect(() => {
    if (!selectedExp || !ticker || !token) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    fetchChain(ticker, selectedExp, token)
      .then((data) => {
        if (!cancelled) {
          setChain(data);
          // Calculate DTE
          const expDate = new Date(selectedExp + 'T16:00:00');
          const now = new Date();
          const dte = Math.max(0, Math.ceil((expDate - now) / (1000 * 60 * 60 * 24)));
          if (onDteLoaded) onDteLoaded(dte);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to fetch chain');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedExp, ticker, token, onDteLoaded]);

  // Parsed chain grouped by strike
  const parsedChain = useMemo(() => {
    if (!chain.length || !quote) return [];
    return parseChainByStrike(chain, quote.last);
  }, [chain, quote]);

  // Add leg from chain click
  const handleChainClick = useCallback(
    (option, direction) => {
      if (!option || !onAddLeg) return;
      const premium = direction === 'long' ? option.ask : option.bid;
      const iv = option.greeks?.mid_iv || 0.30;
      const expDate = new Date(selectedExp + 'T16:00:00');
      const now = new Date();
      const dte = Math.max(1, Math.ceil((expDate - now) / (1000 * 60 * 60 * 24)));

      onAddLeg({
        type: option.option_type,
        direction,
        strike: option.strike,
        premium: premium || 0,
        iv: iv,
        quantity: 1,
        premiumOverride: true,
        dte,
        source: 'tradier',
      });
    },
    [onAddLeg, selectedExp]
  );

  const fmtNum = (n, d = 2) => (n != null ? Number(n).toFixed(d) : '—');

  return (
    <div className="mt-4 fade-in">
      {/* API Settings Toggle */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200"
        >
          <Settings size={13} />
          Market Data {token ? '(Connected)' : '(Not configured)'}
          <ChevronDown size={14} className={`transition-transform ${showSettings ? 'rotate-180' : ''}`} />
        </button>
        {token && quote && (
          <div className="flex items-center gap-3 text-sm">
            <span className="font-mono font-semibold text-white">{ticker}</span>
            <span className="font-mono text-slate-300">${fmtNum(quote.last)}</span>
            <span className={`font-mono text-xs ${quote.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {quote.change >= 0 ? '+' : ''}{fmtNum(quote.change)} ({fmtNum(quote.change_percentage)}%)
            </span>
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 mb-3 fade-in">
          <div className="flex items-start gap-3 mb-3">
            <Key size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-slate-400 mb-2">
                Enter your Tradier sandbox API token for live options data (15-min delayed).
                <a
                  href="https://developer.tradier.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 ml-1 inline-flex items-center gap-0.5"
                >
                  Get a free token <ExternalLink size={10} />
                </a>
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste sandbox token..."
                  className="flex-1 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && saveToken()}
                />
                <button
                  onClick={saveToken}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded"
                >
                  Save
                </button>
                {token && (
                  <button
                    onClick={removeToken}
                    className="px-2 py-1.5 border border-red-800 text-red-400 hover:bg-red-900/30 text-xs rounded"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ticker Search */}
      {token && (
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              placeholder="Ticker (e.g. AAPL)"
              className="w-full pl-8 pr-3 py-1.5 text-sm font-mono uppercase"
              onKeyDown={(e) => e.key === 'Enter' && loadTicker()}
            />
          </div>
          <button
            onClick={loadTicker}
            disabled={loading || !tickerInput.trim()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-semibold rounded flex items-center gap-1.5"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Fetch
          </button>

          {/* Expiration selector */}
          {expirations.length > 0 && (
            <select
              value={selectedExp}
              onChange={(e) => setSelectedExp(e.target.value)}
              className="text-sm py-1.5 px-2 min-w-[140px]"
            >
              {expirations.map((exp) => {
                const d = new Date(exp + 'T12:00:00');
                const dte = Math.max(0, Math.ceil((d - new Date()) / 86400000));
                return (
                  <option key={exp} value={exp}>
                    {exp} ({dte}d)
                  </option>
                );
              })}
            </select>
          )}

          {ticker && (
            <button
              onClick={loadTicker}
              className="p-1.5 text-slate-500 hover:text-slate-300"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs mb-3 bg-red-900/20 border border-red-800/50 rounded px-3 py-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Chain Table */}
      {parsedChain.length > 0 && (
        <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden mb-3">
          <div className="overflow-x-auto" style={{ maxHeight: 360 }}>
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-[#111827] z-10">
                <tr className="border-b border-slate-800">
                  {/* Calls header */}
                  <th colSpan={5} className="px-3 py-2 text-left text-green-400 font-semibold tracking-wider text-[10px] uppercase border-r border-slate-800">
                    Calls — Click Ask to Buy · Bid to Sell
                  </th>
                  <th className="px-3 py-2 text-center text-slate-400 font-semibold text-[10px] uppercase border-r border-slate-800">
                    Strike
                  </th>
                  {/* Puts header */}
                  <th colSpan={5} className="px-3 py-2 text-right text-red-400 font-semibold tracking-wider text-[10px] uppercase">
                    Click Ask to Buy · Bid to Sell — Puts
                  </th>
                </tr>
                <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-2 py-1.5 text-right">IV%</th>
                  <th className="px-2 py-1.5 text-right">Delta</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-amber-500/70">Bid</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-blue-400/70">Ask</th>
                  <th className="px-2 py-1.5 text-right border-r border-slate-800">OI</th>
                  <th className="px-2 py-1.5 text-center border-r border-slate-800">$</th>
                  <th className="px-2 py-1.5 text-left">OI</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-blue-400/70">Ask</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-amber-500/70">Bid</th>
                  <th className="px-2 py-1.5 text-left">Delta</th>
                  <th className="px-2 py-1.5 text-left">IV%</th>
                </tr>
              </thead>
              <tbody>
                {parsedChain.map((row) => {
                  const c = row.call;
                  const p = row.put;
                  const itmBgCall = row.callItm ? 'bg-green-900/10' : '';
                  const itmBgPut = row.putItm ? 'bg-red-900/10' : '';
                  const atmBorder = row.atm ? 'border-y border-blue-500/40' : '';

                  return (
                    <tr
                      key={row.strike}
                      className={`chain-row border-b border-slate-800/30 ${atmBorder}`}
                    >
                      {/* Call side */}
                      <td className={`px-2 py-1 text-right font-mono text-slate-500 ${itmBgCall}`}>
                        {c?.greeks ? fmtNum(c.greeks.mid_iv * 100, 1) : '—'}
                      </td>
                      <td className={`px-2 py-1 text-right font-mono text-blue-300/70 ${itmBgCall}`}>
                        {c?.greeks ? fmtNum(c.greeks.delta, 3) : '—'}
                      </td>
                      <td
                        className={`px-2 py-1 text-right font-mono font-medium text-amber-300 cursor-pointer hover:bg-amber-900/20 ${itmBgCall}`}
                        onClick={() => c && handleChainClick(c, 'short')}
                        title="Sell (short) this call"
                      >
                        {c ? fmtNum(c.bid) : '—'}
                      </td>
                      <td
                        className={`px-2 py-1 text-right font-mono font-medium text-blue-300 cursor-pointer hover:bg-blue-900/20 ${itmBgCall}`}
                        onClick={() => c && handleChainClick(c, 'long')}
                        title="Buy (long) this call"
                      >
                        {c ? fmtNum(c.ask) : '—'}
                      </td>
                      <td className={`px-2 py-1 text-right font-mono text-slate-600 border-r border-slate-800 ${itmBgCall}`}>
                        {c ? (c.open_interest || 0).toLocaleString() : '—'}
                      </td>

                      {/* Strike */}
                      <td className={`px-2 py-1.5 text-center font-mono font-bold border-r border-slate-800 ${
                        row.atm ? 'text-blue-400 bg-blue-900/20' : 'text-slate-300'
                      }`}>
                        {row.strike}
                      </td>

                      {/* Put side */}
                      <td className={`px-2 py-1 text-left font-mono text-slate-600 ${itmBgPut}`}>
                        {p ? (p.open_interest || 0).toLocaleString() : '—'}
                      </td>
                      <td
                        className={`px-2 py-1 text-left font-mono font-medium text-blue-300 cursor-pointer hover:bg-blue-900/20 ${itmBgPut}`}
                        onClick={() => p && handleChainClick(p, 'long')}
                        title="Buy (long) this put"
                      >
                        {p ? fmtNum(p.ask) : '—'}
                      </td>
                      <td
                        className={`px-2 py-1 text-left font-mono font-medium text-amber-300 cursor-pointer hover:bg-amber-900/20 ${itmBgPut}`}
                        onClick={() => p && handleChainClick(p, 'short')}
                        title="Sell (short) this put"
                      >
                        {p ? fmtNum(p.bid) : '—'}
                      </td>
                      <td className={`px-2 py-1 text-left font-mono text-blue-300/70 ${itmBgPut}`}>
                        {p?.greeks ? fmtNum(p.greeks.delta, 3) : '—'}
                      </td>
                      <td className={`px-2 py-1 text-left font-mono text-slate-500 ${itmBgPut}`}>
                        {p?.greeks ? fmtNum(p.greeks.mid_iv * 100, 1) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-600 flex justify-between">
            <span>Data: Tradier Sandbox · 15-min delayed · Greeks via ORATS</span>
            <span>{parsedChain.length} strikes loaded</span>
          </div>
        </div>
      )}
    </div>
  );
}
