import React, { useEffect, useState } from 'react';
import { TradeLog, ExplanationReport } from '../types.js';
import { 
  FileText, 
  Terminal, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft,
  ChevronRight,
  Sparkles,
  HelpCircle,
  Database,
  ShieldAlert
} from 'lucide-react';

interface Props {
  symbol: string;
  refreshTrigger: number;
}

export default function TradesLogPanel({ symbol, refreshTrigger }: Props) {
  const [trades, setTrades] = useState<TradeLog[]>([]);
  const [explanations, setExplanations] = useState<ExplanationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [selectedReport, setSelectedReport] = useState<ExplanationReport | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Trades
      const tradesRes = await fetch('/api/trades');
      if (tradesRes.ok) {
        const data: TradeLog[] = await tradesRes.json();
        // Filter trades by symbol
        setTrades(data.filter(t => t.symbol === symbol));
      }

      // Fetch Explanation Reports
      const expRes = await fetch('/api/explanation-reports');
      if (expRes.ok) {
        const data: ExplanationReport[] = await expRes.json();
        setExplanations(data.filter(e => e.symbol === symbol));
      }
    } catch (err) {
      console.error('Error fetching ledger details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [symbol, refreshTrigger]);

  const filteredTrades = trades.filter(t => {
    const matchesType = filterType === 'ALL' || t.type === filterType;
    const matchesSearch = 
      t.txSignature.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.marketRegime.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-8 font-mono text-xs">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg space-y-1">
          <div className="flex items-center justify-between text-zinc-500 uppercase text-[9px] font-bold">
            <span>Total Logged Trades</span>
            <Terminal className="w-3.5 h-3.5 text-zinc-600" />
          </div>
          <p className="text-xl font-bold font-display text-white">{trades.length}</p>
          <span className="text-[10px] text-zinc-500 uppercase block">Active node instances</span>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg space-y-1">
          <div className="flex items-center justify-between text-zinc-500 uppercase text-[9px] font-bold">
            <span>Audit Trail Reports</span>
            <FileText className="w-3.5 h-3.5 text-zinc-600" />
          </div>
          <p className="text-xl font-bold font-display text-white">{explanations.length}</p>
          <span className="text-[10px] text-zinc-500 uppercase block">Cryptographic records</span>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg space-y-1">
          <div className="flex items-center justify-between text-zinc-500 uppercase text-[9px] font-bold">
            <span>Cumulative Profit / Loss</span>
            <Database className="w-3.5 h-3.5 text-zinc-600" />
          </div>
          {(() => {
            const sumPnL = trades.reduce((acc, t) => acc + t.profitLoss, 0);
            const isPos = sumPnL >= 0;
            return (
              <>
                <p className={`text-xl font-bold font-display ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isPos ? '+' : ''}{sumPnL.toFixed(2)} USDT
                </p>
                <span className="text-[10px] text-zinc-500 uppercase block">Net of fee offsets</span>
              </>
            );
          })()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Trades Ledger */}
        <div className="lg:col-span-8 bg-zinc-950 border border-zinc-800/80 rounded-lg p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
            <div className="space-y-1">
              <h3 className="font-display font-semibold text-sm text-white uppercase tracking-wider">Cryptographic Execution Ledger</h3>
              <p className="text-zinc-500 text-[10px]">Trade Memory logs mapping exact contract fills and micro-slippage</p>
            </div>
            <button 
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded transition self-start cursor-pointer text-[10px]"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              REFRESH
            </button>
          </div>

          {/* Filtering */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/30 p-3 rounded border border-zinc-900">
            <div className="flex flex-wrap gap-1.5">
              {['ALL', 'GRID_ENTRY', 'GRID_EXIT', 'LIQUIDATION_PROTECTION', 'STOP_LOSS', 'TAKE_PROFIT'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2 py-1 rounded text-[9px] uppercase tracking-wide border cursor-pointer font-bold ${
                    filterType === type
                      ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold'
                      : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-400 border-zinc-850'
                  }`}
                >
                  {type.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
              <input
                type="text"
                placeholder="Search TX/regime..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 bg-zinc-950 border border-zinc-850 rounded text-zinc-300 placeholder-zinc-600 text-[10px] w-full sm:w-48 focus:outline-none focus:border-zinc-700"
              />
            </div>
          </div>

          {/* Ledger Table */}
          {loading && filteredTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <RefreshCw className="w-6 h-6 animate-spin mb-2" />
              <span>Querying trade database...</span>
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-zinc-900 rounded text-zinc-500 space-y-2">
              <Database className="w-8 h-8 text-zinc-800" />
              <p>No records found matching filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-zinc-900 text-[10px]">
                <thead>
                  <tr className="bg-zinc-900/40 text-zinc-500 border-b border-zinc-900 uppercase text-[9px] font-bold">
                    <th className="px-3 py-2 border-r border-zinc-900">TIMESTAMP</th>
                    <th className="px-3 py-2 border-r border-zinc-900">TYPE</th>
                    <th className="px-3 py-2 border-r border-zinc-900">SIDE</th>
                    <th className="px-3 py-2 border-r border-zinc-900 text-right">PRICE</th>
                    <th className="px-3 py-2 border-r border-zinc-900 text-right">AMOUNT (USDT)</th>
                    <th className="px-3 py-2 border-r border-zinc-900 text-right">PROFIT / LOSS</th>
                    <th className="px-3 py-2 text-right">TX PROOF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 bg-zinc-950/20">
                  {filteredTrades.map((trade) => {
                    const isBuy = trade.side === 'BUY';
                    const isPos = trade.profitLoss >= 0;
                    return (
                      <tr key={trade.id} className="hover:bg-zinc-900/15">
                        <td className="px-3 py-2.5 text-zinc-400 border-r border-zinc-900">
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-3 py-2.5 font-bold border-r border-zinc-900 uppercase text-zinc-300">
                          {trade.type.replace(/_/g, ' ')}
                        </td>
                        <td className="px-3 py-2.5 border-r border-zinc-900 font-bold">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] flex items-center gap-0.5 w-fit ${
                            isBuy ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30' : 'bg-rose-950/30 text-rose-400 border border-rose-900/30'
                          }`}>
                            {isBuy ? <ArrowDownLeft className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
                            {trade.side}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-zinc-300 border-r border-zinc-900">
                          {trade.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 text-right text-zinc-450 border-r border-zinc-900">
                          {trade.amountUsdt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-bold border-r border-zinc-900 ${
                          trade.profitLoss === 0 ? 'text-zinc-500' : isPos ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {trade.profitLoss === 0 ? '0.00' : `${isPos ? '+' : ''}${trade.profitLoss.toFixed(2)} USDT`}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-zinc-500 select-all hover:text-zinc-300 cursor-pointer">
                          {trade.txSignature.substring(0, 10)}...
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Right Column: Explanation Audits */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5 space-y-4">
            <div className="border-b border-zinc-900 pb-3">
              <h3 className="font-display font-semibold text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                Explanation Audit Trail
              </h3>
              <p className="text-zinc-500 text-[10px] mt-0.5">Fiduciary verification logs explaining every strategy compilation</p>
            </div>

            {explanations.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 border border-dashed border-zinc-900 rounded">
                <HelpCircle className="w-6 h-6 mx-auto text-zinc-800 mb-1" />
                <span>No audit reports compiled.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {explanations.map((exp) => (
                  <button
                    key={exp.decisionId}
                    onClick={() => setSelectedReport(exp)}
                    className={`w-full text-left p-3 rounded border font-mono transition flex items-center justify-between cursor-pointer ${
                      selectedReport?.decisionId === exp.decisionId
                        ? 'bg-zinc-900 border-zinc-700'
                        : 'bg-zinc-950 border-zinc-900 hover:bg-zinc-900/40 hover:border-zinc-800'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-[10px]">{exp.decisionId}</span>
                        <span className="px-1 bg-zinc-850 text-zinc-400 rounded text-[8px] font-bold uppercase">{exp.strategyType}</span>
                      </div>
                      <span className="text-zinc-500 text-[9px] block">
                        {new Date(exp.timestamp).toLocaleTimeString()} • Confidence: {exp.confidence}%
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Detail Report Modal/Card */}
          {selectedReport && (
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-5 space-y-4 shadow-xl border-t-2 border-t-emerald-500">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-bold">EXPLANATION AUDIT REPORT</span>
                  <h4 className="font-display font-semibold text-xs text-white uppercase font-mono tracking-tight">{selectedReport.decisionId}</h4>
                </div>
                <span className="px-2 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 rounded-[3px] font-bold text-[8.5px]">
                  CONFIDENCE: {selectedReport.confidence}%
                </span>
              </div>

              <div className="space-y-3.5 text-[10px]">
                <div className="space-y-1 bg-zinc-900/30 p-2.5 rounded border border-zinc-900">
                  <span className="text-zinc-500 uppercase font-bold text-[8.5px]">QUANT STRATEGIC MANDATE</span>
                  <p className="text-zinc-300 leading-relaxed text-[9px]">{selectedReport.reason}</p>
                </div>

                <div className="space-y-1 bg-zinc-900/30 p-2.5 rounded border border-zinc-900">
                  <span className="text-rose-400 uppercase font-bold text-[8.5px]">RISK ASSESSMENT GATEWAY</span>
                  <div className="flex justify-between items-center text-zinc-300 mt-1">
                    <span>Risk Severity:</span>
                    <strong className={selectedReport.riskScore > 60 ? 'text-amber-400' : 'text-emerald-400'}>
                      {selectedReport.riskScore} / 100
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-zinc-300">
                    <span>Expected Max Drawdown:</span>
                    <strong>{selectedReport.expectedDrawdown.toFixed(2)}%</strong>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-zinc-500 uppercase font-bold text-[8.5px] block">SYSTEM HYPERPARAMETER INPUTS</span>
                  <div className="grid grid-cols-2 gap-2 text-zinc-400">
                    {Object.entries(selectedReport.indicatorsUsed).map(([k, v]) => (
                      <div key={k} className="bg-zinc-950 p-1.5 rounded border border-zinc-900/60 flex justify-between">
                        <span className="uppercase text-[8px] text-zinc-500 font-bold">{k}</span>
                        <span className="font-bold text-zinc-300">{typeof v === 'number' ? v.toFixed(4) : v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1 text-zinc-500 border-t border-zinc-900 pt-3">
                  <div className="flex justify-between text-[9px]">
                    <span>COMPILATION COGNITIVE MODEL:</span>
                    <span className="text-zinc-400 font-bold uppercase">{selectedReport.aiVersion}</span>
                  </div>
                  <div className="flex justify-between text-[9px] mt-1">
                    <span>FIDUCIARY EVIDENCE SOURCE:</span>
                    <span className="text-zinc-400 font-bold uppercase">{selectedReport.sourcesUsed[0]}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
