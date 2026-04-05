import React, { useState, useCallback, useMemo } from 'react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  Search, Key, X, Loader2, ChevronDown, ChevronUp, AlertCircle, ExternalLink,
  Calendar, TrendingUp, Clock, Download, Info, FileJson, FileSpreadsheet,
} from 'lucide-react';
import {
  getStoredAvKey, setStoredAvKey, clearStoredAvKey,
  fetchDailyHistory, fetchWeeklyHistory, fetchMonthlyHistory, fetchIntradayHistory,
  fetchHistoricalOptions, parseHistoricalChainByStrike,
  toCSV, downloadFile,
} from '../lib/alphaVantageApi.js';
import AlphaVantageInfo from './AlphaVantageInfo.jsx';

/** Interval options for the selector */
const INTERVALS = [
  { value: 'intraday_1min',  label: 'Intraday 1min',  group: 'Intraday' },
  { value: 'intraday_5min',  label: 'Intraday 5min',  group: 'Intraday' },
  { value: 'intraday_15min', label: 'Intraday 15min', group: 'Intraday' },
  { value: 'intraday_30min', label: 'Intraday 30min', group: 'Intraday' },
  { value: 'intraday_60min', label: 'Intraday 60min', group: 'Intraday' },
  { value: 'daily',          label: 'Daily',           group: 'End of Day' },
  { value: 'weekly',         label: 'Weekly',          group: 'End of Day' },
  { value: 'monthly',        label: 'Monthly',         group: 'End of Day' },
];

/**
 * Historical data panel with Alpha Vantage integration.
 * Shows historical price charts, download options, and historical options chains.
 *
 * Props:
 *   onHistoricalQuote({ symbol, close, date }) — called when a date is selected on the chart
 *   onAddLeg(leg) — callback to add a historical option as a leg
 */
export default function HistoricalData({ onHistoricalQuote, onAddLeg }) {
  const [apiKey, setApiKey] = useState(getStoredAvKey);
  const [keyInput, setKeyInput] = useState(apiKey);
  const [showSettings, setShowSettings] = useState(!apiKey);
  const [showInfo, setShowInfo] = useState(false);

  const [ticker, setTicker] = useState('');
  const [tickerInput, setTickerInput] = useState('');
  const [interval, setInterval] = useState('daily');
  const [outputSize, setOutputSize] = useState('compact');

  const [priceData, setPriceData] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [historicalChain, setHistoricalChain] = useState([]);

  const [loading, setLoading] = useState(false);
  const [chainLoading, setChainLoading] = useState(false);
  const [error, setError] = useState('');

  // Persist key
  const saveKey = useCallback(() => {
    const k = keyInput.trim();
    setApiKey(k);
    setStoredAvKey(k);
    if (k) setShowSettings(false);
  }, [keyInput]);

  const removeKey = useCallback(() => {
    setApiKey('');
    setKeyInput('');
    clearStoredAvKey();
    setShowSettings(true);
    setPriceData([]);
    setHistoricalChain([]);
    setTicker('');
  }, []);

  // Fetch historical prices based on selected interval
  const loadHistory = useCallback(async () => {
    const sym = tickerInput.trim().toUpperCase();
    if (!sym || !apiKey) return;
    setLoading(true);
    setError('');
    setPriceData([]);
    setHistoricalChain([]);
    setSelectedDate('');
    try {
      let data;
      if (interval.startsWith('intraday_')) {
        const ivl = interval.replace('intraday_', '');
        data = await fetchIntradayHistory(sym, apiKey, ivl, outputSize);
      } else if (interval === 'weekly') {
        data = await fetchWeeklyHistory(sym, apiKey);
      } else if (interval === 'monthly') {
        data = await fetchMonthlyHistory(sym, apiKey);
      } else {
        data = await fetchDailyHistory(sym, apiKey, outputSize);
      }
      setTicker(sym);
      setPriceData(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch historical data');
    } finally {
      setLoading(false);
    }
  }, [tickerInput, apiKey, interval, outputSize]);

  // Fetch historical options for selected date
  const loadHistoricalOptions = useCallback(async (date) => {
    if (!ticker || !apiKey || !date) return;
    // Only daily/weekly/monthly dates make sense for options lookup
    const dateOnly = date.split(' ')[0]; // strip time from intraday timestamps
    setSelectedDate(dateOnly);
    setChainLoading(true);
    setHistoricalChain([]);

    const dayData = priceData.find((d) => d.date === date);
    if (dayData && onHistoricalQuote) {
      onHistoricalQuote({ symbol: ticker, close: dayData.close, date: dateOnly });
    }

    try {
      const options = await fetchHistoricalOptions(ticker, apiKey, dateOnly);
      setHistoricalChain(options);
    } catch {
      setHistoricalChain([]);
    } finally {
      setChainLoading(false);
    }
  }, [ticker, apiKey, priceData, onHistoricalQuote]);

  // Chart click handler
  const handleChartClick = useCallback((data) => {
    if (data?.activePayload?.[0]?.payload?.date) {
      loadHistoricalOptions(data.activePayload[0].payload.date);
    }
  }, [loadHistoricalOptions]);

  // Parsed chain for display
  const parsedChain = useMemo(() => {
    if (!historicalChain.length) return [];
    const dateOnly = selectedDate.split(' ')[0];
    const dayData = priceData.find((d) => d.date.startsWith(dateOnly));
    const spot = dayData?.close || 0;
    return parseHistoricalChainByStrike(historicalChain, spot);
  }, [historicalChain, priceData, selectedDate]);

  // Add historical option as leg
  const handleChainClick = useCallback(
    (option, direction) => {
      if (!option || !onAddLeg) return;
      const premium = direction === 'long' ? option.ask : option.bid;
      onAddLeg({
        type: option.option_type,
        direction,
        strike: option.strike,
        premium: premium || option.last || 0,
        iv: option.greeks?.mid_iv || 0.30,
        quantity: 1,
        premiumOverride: true,
        source: 'alpha_vantage',
      });
    },
    [onAddLeg]
  );

  // Download handlers
  const handleDownloadCSV = useCallback(() => {
    if (!priceData.length || !ticker) return;
    const csv = toCSV(priceData);
    downloadFile(csv, `${ticker}_${interval}_${priceData[0].date}_to_${priceData[priceData.length - 1].date}.csv`, 'text/csv');
  }, [priceData, ticker, interval]);

  const handleDownloadJSON = useCallback(() => {
    if (!priceData.length || !ticker) return;
    const json = JSON.stringify(priceData, null, 2);
    downloadFile(json, `${ticker}_${interval}_${priceData[0].date}_to_${priceData[priceData.length - 1].date}.json`, 'application/json');
  }, [priceData, ticker, interval]);

  const handleDownloadOptionsCSV = useCallback(() => {
    if (!historicalChain.length || !ticker) return;
    const csv = toCSV(historicalChain);
    downloadFile(csv, `${ticker}_options_${selectedDate}.csv`, 'text/csv');
  }, [historicalChain, ticker, selectedDate]);

  // Summary stats
  const stats = useMemo(() => {
    if (priceData.length < 2) return null;
    const latest = priceData[priceData.length - 1];
    const earliest = priceData[0];
    const high = Math.max(...priceData.map((d) => d.high));
    const low = Math.min(...priceData.map((d) => d.low));
    const change = latest.close - earliest.close;
    const changePct = (change / earliest.close) * 100;
    const avgVolume = Math.round(priceData.reduce((s, d) => s + d.volume, 0) / priceData.length);
    return { latest, earliest, high, low, change, changePct, avgVolume };
  }, [priceData]);

  const fmtNum = (n, d = 2) => (n != null ? Number(n).toFixed(d) : '—');

  const isIntraday = interval.startsWith('intraday_');

  // Custom tooltip for the price chart
  const PriceTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-xs shadow-lg">
        <div className="font-mono text-slate-400 mb-1">{d.date}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono">
          <span className="text-slate-500">Open</span><span className="text-slate-200">${fmtNum(d.open)}</span>
          <span className="text-slate-500">High</span><span className="text-green-400">${fmtNum(d.high)}</span>
          <span className="text-slate-500">Low</span><span className="text-red-400">${fmtNum(d.low)}</span>
          <span className="text-slate-500">Close</span><span className="text-white font-semibold">${fmtNum(d.close)}</span>
          <span className="text-slate-500">Vol</span><span className="text-slate-300">{d.volume?.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4 fade-in">
      {/* API Settings Toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200"
          >
            <TrendingUp size={13} />
            Alpha Vantage {apiKey ? '(Connected)' : '(Not configured)'}
            <ChevronDown size={14} className={`transition-transform ${showSettings ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border transition-colors ${
              showInfo
                ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400'
                : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500'
            }`}
            title="Show available API endpoints and ticker search"
          >
            <Info size={11} />
            API Info
          </button>
        </div>
        {stats && (
          <div className="flex items-center gap-3 text-sm">
            <span className="font-mono font-semibold text-white">{ticker}</span>
            <span className="font-mono text-slate-300">${fmtNum(stats.latest.close)}</span>
            <span className={`font-mono text-xs ${stats.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.change >= 0 ? '+' : ''}{fmtNum(stats.change)} ({fmtNum(stats.changePct)}%)
            </span>
            <span className="text-[10px] text-slate-600">{priceData.length} pts</span>
          </div>
        )}
      </div>

      {/* API Info Panel */}
      {showInfo && <AlphaVantageInfo />}

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 mb-3 fade-in">
          <div className="flex items-start gap-3 mb-3">
            <Key size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-slate-400 mb-2">
                Enter your Alpha Vantage API key for historical stock & options data.
                <a
                  href="https://www.alphavantage.co/support/#api-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 ml-1 inline-flex items-center gap-0.5"
                >
                  Get a free key <ExternalLink size={10} />
                </a>
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Paste API key..."
                  className="flex-1 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && saveKey()}
                />
                <button
                  onClick={saveKey}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded"
                >
                  Save
                </button>
                {apiKey && (
                  <button
                    onClick={removeKey}
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

      {/* Ticker Search + Controls */}
      {apiKey && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* Ticker input */}
          <div className="relative flex-1 max-w-[160px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              placeholder="Ticker"
              className="w-full pl-8 pr-3 py-1.5 text-sm font-mono uppercase"
              onKeyDown={(e) => e.key === 'Enter' && loadHistory()}
            />
          </div>

          {/* Interval selector */}
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="text-sm py-1.5 px-2"
          >
            {(() => {
              let lastGroup = '';
              return INTERVALS.map((ivl) => {
                const showGroup = ivl.group !== lastGroup;
                lastGroup = ivl.group;
                return (
                  <option key={ivl.value} value={ivl.value}>
                    {showGroup ? `${ivl.group}: ` : '  '}{ivl.label}
                  </option>
                );
              });
            })()}
          </select>

          {/* Output size (only for daily and intraday) */}
          {(interval === 'daily' || isIntraday) && (
            <select
              value={outputSize}
              onChange={(e) => setOutputSize(e.target.value)}
              className="text-sm py-1.5 px-2"
            >
              <option value="compact">Compact ({interval === 'daily' ? '100 days' : '100 pts'})</option>
              <option value="full">Full ({interval === 'daily' ? '20+ yrs' : 'max'})</option>
            </select>
          )}

          {/* Fetch button */}
          <button
            onClick={loadHistory}
            disabled={loading || !tickerInput.trim()}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-semibold rounded flex items-center gap-1.5"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <TrendingUp size={13} />}
            Load
          </button>

          {/* Download buttons */}
          {priceData.length > 0 && (
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-[10px] text-slate-600 mr-1">Export:</span>
              <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-1 px-2 py-1 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 rounded text-[11px]"
                title="Download as CSV"
              >
                <FileSpreadsheet size={11} /> CSV
              </button>
              <button
                onClick={handleDownloadJSON}
                className="flex items-center gap-1 px-2 py-1 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 rounded text-[11px]"
                title="Download as JSON"
              >
                <FileJson size={11} /> JSON
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs mb-3 bg-red-900/20 border border-red-800/50 rounded px-3 py-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Price Chart */}
      {priceData.length > 0 && (
        <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden mb-3">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              <Calendar size={12} className="inline mr-1.5" />
              {ticker} — {INTERVALS.find((i) => i.value === interval)?.label || 'Daily'}
              <span className="text-slate-600 ml-2 normal-case">
                {priceData[0].date} to {priceData[priceData.length - 1].date}
              </span>
            </span>
            {selectedDate && (
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                <Clock size={11} /> Selected: {selectedDate}
              </span>
            )}
          </div>
          <div className="p-3">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={priceData} onClick={handleChartClick} style={{ cursor: 'crosshair' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickFormatter={(d) => isIntraday ? d.slice(11, 16) : d.slice(5)}
                  interval="preserveStartEnd"
                  stroke="#334155"
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(v) => `$${v}`}
                  stroke="#334155"
                />
                <Tooltip content={<PriceTooltip />} />
                <Bar dataKey="volume" fill="#334155" opacity={0.3} yAxisId="vol" />
                <YAxis yAxisId="vol" orientation="right" hide domain={[0, (dm) => dm * 4]} />
                <Line
                  dataKey="close"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                {selectedDate && (
                  <ReferenceLine
                    x={selectedDate}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-slate-600 mt-1">
              {isIntraday
                ? 'Intraday data shown — click a bar to select that timestamp'
                : 'Click a date on the chart to load historical options for that day'}
            </p>
          </div>

          {/* Summary Stats */}
          {stats && (
            <div className="px-3 pb-3 grid grid-cols-5 gap-2">
              {[
                { label: 'Period High', value: `$${fmtNum(stats.high)}`, color: 'text-green-400' },
                { label: 'Period Low', value: `$${fmtNum(stats.low)}`, color: 'text-red-400' },
                { label: 'Start', value: `$${fmtNum(stats.earliest.close)}`, color: 'text-slate-300' },
                { label: 'End', value: `$${fmtNum(stats.latest.close)}`, color: 'text-slate-300' },
                { label: 'Avg Volume', value: stats.avgVolume.toLocaleString(), color: 'text-slate-400' },
              ].map((s) => (
                <div key={s.label} className="bg-slate-900/50 rounded px-2.5 py-1.5">
                  <div className="text-[10px] text-slate-500 uppercase">{s.label}</div>
                  <div className={`font-mono text-sm font-semibold ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Historical Options Chain Loading */}
      {chainLoading && (
        <div className="flex items-center gap-2 text-emerald-400 text-xs mb-3">
          <Loader2 size={14} className="animate-spin" /> Loading historical options for {selectedDate}...
        </div>
      )}

      {/* Historical Options Chain Table */}
      {parsedChain.length > 0 && (
        <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden mb-3">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Historical Options — {ticker} — {selectedDate}
            </span>
            <button
              onClick={handleDownloadOptionsCSV}
              className="flex items-center gap-1 px-2 py-0.5 border border-slate-700 text-slate-500 hover:text-slate-200 hover:border-slate-500 rounded text-[10px]"
              title="Download options chain as CSV"
            >
              <Download size={10} /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: 300 }}>
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-[#111827] z-10">
                <tr className="border-b border-slate-800">
                  <th colSpan={5} className="px-3 py-2 text-left text-green-400 font-semibold tracking-wider text-[10px] uppercase border-r border-slate-800">
                    Calls — Click Ask to Buy · Bid to Sell
                  </th>
                  <th className="px-3 py-2 text-center text-slate-400 font-semibold text-[10px] uppercase border-r border-slate-800">
                    Strike
                  </th>
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
                  const atmBorder = row.atm ? 'border-y border-emerald-500/40' : '';

                  return (
                    <tr key={row.strike} className={`chain-row border-b border-slate-800/30 ${atmBorder}`}>
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
                        row.atm ? 'text-emerald-400 bg-emerald-900/20' : 'text-slate-300'
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
            <span>Data: Alpha Vantage · Historical · {selectedDate}</span>
            <span>{parsedChain.length} strikes loaded</span>
          </div>
        </div>
      )}
    </div>
  );
}
