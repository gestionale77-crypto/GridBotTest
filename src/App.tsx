import React, { useState } from 'react';
import MarketIntelligence from './components/MarketIntelligence.jsx';
import DeployGridPanel from './components/DeployGridPanel.jsx';
import ActiveGridsPanel from './components/ActiveGridsPanel.jsx';
import HyperliquidConnectionPanel from './components/HyperliquidConnectionPanel.jsx';
import TradesLogPanel from './components/TradesLogPanel.jsx';
import SelfOptimizationPanel from './components/SelfOptimizationPanel.jsx';
import { Shield, Sparkles, FileText, Settings2 } from 'lucide-react';

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC-USDT');
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'workspace' | 'trades' | 'optimize' | 'hl'>('workspace');

  const triggerRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const assetNodes = [
    { name: 'Bitcoin Node', symbol: 'BTC-USDT', icon: '₿' },
    { name: 'Ethereum Node', symbol: 'ETH-USDT', icon: 'Ξ' },
    { name: 'Solana Node', symbol: 'SOL-USDT', icon: '◎' },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-[#d4d4d8] selection:bg-zinc-800 selection:text-white">
      {/* Top Navbar */}
      <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center font-bold text-zinc-950 font-display text-sm">
              H
            </div>
            <div>
              <h1 className="font-display font-semibold tracking-tight text-white text-base uppercase">Grid Trading Station</h1>
              <span className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase block">
                Hyperliquid Gateway
              </span>
            </div>
          </div>

          {/* Status widget */}
          <div className="hidden md:flex items-center gap-6 text-xs font-mono">
            <div className="text-right">
              <span className="text-zinc-500 text-[9px] block uppercase font-mono">Network Gateway</span>
              <span className="text-zinc-300 flex items-center gap-1.5 justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                LIVE_HYPERLIQUID
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Asset Selector Bar */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Active Asset Node:</span>
            <div className="flex flex-wrap gap-2">
              {assetNodes.map((node) => {
                const isActive = selectedSymbol === node.symbol;
                return (
                  <button
                    key={node.symbol}
                    onClick={() => {
                      setSelectedSymbol(node.symbol);
                      triggerRefresh();
                    }}
                    className={`px-4 py-2 rounded text-xs font-mono transition flex items-center gap-2 border cursor-pointer ${
                      isActive
                        ? 'bg-zinc-100 text-zinc-950 font-bold border-zinc-100 shadow-md'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    <span>{node.icon}</span>
                    {node.symbol}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-xs font-mono text-zinc-500 text-center sm:text-right">
            Current system date: <span className="text-zinc-300">2026-07-12 UTC</span>
          </div>
        </div>

        {/* Real-time Data Disclaimer */}
        <div className="bg-zinc-950/40 border border-zinc-800 p-4 rounded-lg flex gap-3 text-xs leading-relaxed text-zinc-400 font-mono">
          <Sparkles className="w-5 h-5 shrink-0 text-emerald-400" />
          <div>
            <span className="font-bold text-white block uppercase text-[10px]">Real-Time Market Data</span>
            Every market value, Bollinger band, RSI, and ATR metric on this workspace is dynamically compiled via live Hyperliquid public API relays. All mathematical grid executions simulate matching fills natively in real-time.
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('workspace')}
            className={`px-5 py-3 font-display font-bold text-[11px] uppercase tracking-wider transition-all duration-150 cursor-pointer border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'workspace' 
                ? 'text-white border-emerald-500 bg-zinc-900/10' 
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Workstation
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`px-5 py-3 font-display font-bold text-[11px] uppercase tracking-wider transition-all duration-150 cursor-pointer border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'trades' 
                ? 'text-white border-emerald-500 bg-zinc-900/10' 
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Execution Ledger
          </button>
          <button
            onClick={() => setActiveTab('optimize')}
            className={`px-5 py-3 font-display font-bold text-[11px] uppercase tracking-wider transition-all duration-150 cursor-pointer border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'optimize' 
                ? 'text-white border-emerald-500 bg-zinc-900/10' 
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Self-Optimization
          </button>
          <button
            onClick={() => setActiveTab('hl')}
            className={`px-5 py-3 font-display font-bold text-[11px] uppercase tracking-wider transition-all duration-150 cursor-pointer border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'hl' 
                ? 'text-white border-emerald-500 bg-zinc-900/10' 
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Hyperliquid Connection
          </button>
        </div>

        {activeTab === 'workspace' && (
          /* Workstation Layout Grid */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column (7 cols): Market Intelligence */}
            <div className="lg:col-span-7 space-y-8">
              <MarketIntelligence 
                symbol={selectedSymbol} 
                onIndicatorsLoaded={triggerRefresh} 
              />
            </div>

            {/* Right Column (5 cols): Deploy Grid Panel & Active Grids */}
            <div className="lg:col-span-5 space-y-8">
              <DeployGridPanel 
                symbol={selectedSymbol} 
                onGridDeployed={triggerRefresh} 
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                    Active Running Engines
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-600">Live monitoring active</span>
                </div>
                <ActiveGridsPanel 
                  symbol={selectedSymbol} 
                  refreshTrigger={refreshKey} 
                  onGridStopped={triggerRefresh} 
                />
              </div>
            </div>

          </div>
        )}

        {activeTab === 'trades' && (
          <TradesLogPanel symbol={selectedSymbol} refreshTrigger={refreshKey} />
        )}

        {activeTab === 'optimize' && (
          <SelfOptimizationPanel symbol={selectedSymbol} refreshTrigger={refreshKey} />
        )}

        {activeTab === 'hl' && (
          <HyperliquidConnectionPanel onStateChange={triggerRefresh} refreshTrigger={refreshKey} />
        )}
      </main>

      {/* Standard Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950 py-8 text-center text-[10px] font-mono text-zinc-500">
        <p>© 2026 Grid Trading Station. Dynamic mathematical modeling and automated grid strategy execution.</p>
        <p className="mt-1">Verifiable ledger and public exchange relays connected to live Hyperliquid API endpoints.</p>
      </footer>
    </div>
  );
}
