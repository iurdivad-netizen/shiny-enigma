import React, { useState, useCallback, useMemo } from 'react';
import {
  Info, ChevronDown, ExternalLink, Search, Loader2, Globe,
  Tag, Zap, Database, BarChart3, DollarSign, Newspaper, Activity,
} from 'lucide-react';
import { AV_ENDPOINTS, getEndpointsByCategory, searchTicker, getStoredAvKey } from '../lib/alphaVantageApi.js';

const CATEGORY_ICONS = {
  'Stock Prices': BarChart3,
  'Options': Activity,
  'Reference': Search,
  'Sentiment': Newspaper,
  'Fundamentals': Database,
  'Technical Indicator': Zap,
  'Economic': DollarSign,
};

const CATEGORY_COLORS = {
  'Stock Prices': '#10b981',
  'Options': '#8b5cf6',
  'Reference': '#60a5fa',
  'Sentiment': '#f59e0b',
  'Fundamentals': '#ec4899',
  'Technical Indicator': '#06b6d4',
  'Economic': '#f97316',
};

/**
 * API Info panel showing all available Alpha Vantage endpoints
 * and a ticker search tool.
 */
export default function AlphaVantageInfo() {
  const [expandedCat, setExpandedCat] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const categories = useMemo(() => getEndpointsByCategory(), []);

  const toggleCat = useCallback((cat) => {
    setExpandedCat((prev) => (prev === cat ? null : cat));
  }, []);

  // Ticker search using the SYMBOL_SEARCH endpoint
  const doSearch = useCallback(async () => {
    const key = getStoredAvKey();
    const q = searchInput.trim();
    if (!q) return;
    if (!key) {
      setSearchError('Save your Alpha Vantage API key first (in the Historical Data section).');
      return;
    }
    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const results = await searchTicker(q, key);
      setSearchResults(results);
      if (results.length === 0) setSearchError('No matches found.');
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  }, [searchInput]);

  return (
    <div className="mt-3 fade-in">
      {/* Ticker Search Tool */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={13} className="text-blue-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Ticker Search
          </span>
          <span className="text-[10px] text-slate-600">— find any symbol by name or keyword</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="e.g. Apple, Tesla, MSFT..."
              className="w-full pl-8 pr-3 py-1.5 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            />
          </div>
          <button
            onClick={doSearch}
            disabled={searching || !searchInput.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-semibold rounded flex items-center gap-1.5"
          >
            {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Search
          </button>
        </div>
        {searchError && (
          <p className="text-red-400 text-[11px] mt-1.5">{searchError}</p>
        )}
        {searchResults.length > 0 && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase">
                  <th className="px-2 py-1 text-left">Symbol</th>
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left">Type</th>
                  <th className="px-2 py-1 text-left">Region</th>
                  <th className="px-2 py-1 text-left">Currency</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((r) => (
                  <tr key={r.symbol} className="border-b border-slate-800/30 hover:bg-slate-800/40">
                    <td className="px-2 py-1.5 font-mono font-semibold text-emerald-400">{r.symbol}</td>
                    <td className="px-2 py-1.5 text-slate-300 max-w-[200px] truncate">{r.name}</td>
                    <td className="px-2 py-1.5">
                      <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 text-[10px]">
                        {r.type}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-slate-500">{r.region}</td>
                    <td className="px-2 py-1.5 text-slate-500">{r.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Endpoints Catalog */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info size={13} className="text-emerald-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Available API Endpoints
            </span>
            <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">
              {AV_ENDPOINTS.length} endpoints
            </span>
          </div>
          <a
            href="https://www.alphavantage.co/documentation/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
          >
            Full Docs <ExternalLink size={9} />
          </a>
        </div>

        <div className="divide-y divide-slate-800/50">
          {Object.entries(categories).map(([cat, endpoints]) => {
            const Icon = CATEGORY_ICONS[cat] || Database;
            const color = CATEGORY_COLORS[cat] || '#94a3b8';
            const isExpanded = expandedCat === cat;

            return (
              <div key={cat}>
                <button
                  onClick={() => toggleCat(cat)}
                  className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Icon size={14} style={{ color }} />
                    <span className="text-sm font-medium text-slate-200">{cat}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: color + '20', color }}
                    >
                      {endpoints.length}
                    </span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 fade-in">
                    {endpoints.map((ep) => (
                      <div
                        key={ep.id}
                        className="bg-slate-900/60 rounded-md px-3 py-2.5 border border-slate-800/50"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-semibold" style={{ color }}>
                            {ep.name}
                          </span>
                          <code className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                            {ep.id}
                          </code>
                          <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800/30">
                            {ep.tier}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-1.5">{ep.description}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                          <span className="text-slate-500">
                            <Tag size={9} className="inline mr-0.5" />
                            Params: <span className="text-slate-400">{ep.params.join(', ')}</span>
                          </span>
                          <span className="text-slate-500">
                            History: <span className="text-slate-400">{ep.historyDepth}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-600 flex justify-between">
          <span>Free tier: 25 API calls/day · All data JSON format</span>
          <span>alphavantage.co</span>
        </div>
      </div>
    </div>
  );
}
