import React, { useEffect, useState } from 'react';
import { GridConfig, GridLevel, MarketIndicators } from '../types.js';
import { Layers, ShieldAlert, Sparkles, TrendingUp, TrendingDown, RefreshCw, XOctagon, Info } from 'lucide-react';

interface Props {
  symbol: string;
  refreshTrigger: number;
  onGridStopped: () => void;
}

export default function ActiveGridsPanel({ symbol, refreshTrigger, onGridStopped }: Props) {
  const [activeGrids, setActiveGrids] = useState<GridConfig[]>([]);
  const [gridLevels, setGridLevels] = useState<Record<string, GridLevel[]>>({});
  const [loading, setLoading] = useState(true);
  const [stoppingGridId, setStoppingGridId] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<MarketIndicators | null>(null);

  const fetchActiveGrids = async () => {
    try {
      const res = await fetch('/api/active-grids');
      if (!res.ok) return;
      
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return;
      }
      const grids: GridConfig[] = await res.json();
      
      // Filter by current active symbol
      const filtered = grids.filter(g => g.symbol === symbol);
      setActiveGrids(filtered);

      // Fetch levels for each grid
      const levelsMap: Record<string, GridLevel[]> = {};
      for (const grid of filtered) {
        const lvlRes = await fetch(`/api/grid-levels?gridId=${grid.id}`);
        if (lvlRes.ok) {
          const lvlContentType = lvlRes.headers.get('content-type');
          if (lvlContentType && lvlContentType.includes('application/json')) {
            levelsMap[grid.id] = await lvlRes.json();
          }
        }
      }
      setGridLevels(levelsMap);

      // Fetch market indicators for drawing current price
      const indRes = await fetch(`/api/market-indicators?symbol=${symbol}`);
      if (indRes.ok) {
        const indContentType = indRes.headers.get('content-type');
        if (indContentType && indContentType.includes('application/json')) {
          setIndicators(await indRes.json());
        }
      }
    } catch (err) {
      console.error('Error syncing grids:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveGrids();
    // Poll active grids status every 4 seconds to show real-time fills and PnL
    const interval = setInterval(fetchActiveGrids, 4000);
    return () => clearInterval(interval);
  }, [symbol, refreshTrigger]);

  const handleStopGrid = async (gridId: string) => {
    try {
      setStoppingGridId(gridId);
      const res = await fetch('/api/stop-grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gridId }),
      });

      if (!res.ok) throw new Error('Failed to terminate grid');
      
      onGridStopped();
      await fetchActiveGrids();
    } catch (err) {
      console.error(err);
      alert('Error terminating grid.');
    } finally {
      setStoppingGridId(null);
    }
  };

  if (loading && activeGrids.length === 0) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 flex items-center justify-center min-h-[200px]">
        <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin mr-2" />
        <span className="text-zinc-400 font-mono text-sm">Syncing Active Order Nodes...</span>
      </div>
    );
  }

  if (activeGrids.length === 0) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[250px]">
        <Layers className="w-10 h-10 text-zinc-600" />
        <h3 className="font-display font-medium text-white text-sm">No Active Adaptive Grids</h3>
        <p className="text-zinc-400 text-xs max-w-sm leading-relaxed">
          The quantum market engine is currently idle for {symbol}. Select an objective above and compile a strategy to deploy.
        </p>
      </div>
    );
  }

  return (
    <div id="active-grids-section" className="space-y-6">
      {activeGrids.map((grid) => {
        const levels = gridLevels[grid.id] || [];
        const livePrice = indicators?.lastPrice || grid.lowerPrice + (grid.upperPrice - grid.lowerPrice) / 2;
        const currentRoiIsPos = grid.totalPnL >= 0;

        return (
          <div key={grid.id} className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-2xl space-y-6 p-6">
            
            {/* Grid Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-zinc-850 px-2 py-0.5 rounded border border-zinc-800 text-white">
                    {grid.symbol}
                  </span>
                  <span className="text-xs font-mono text-emerald-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                    {grid.strategyMode}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">ID: {grid.id}</span>
                </div>
                <p className="text-zinc-400 text-xs font-mono">
                  Compiled under <span className="text-zinc-300">{grid.regime.replace(/_/g, ' ')}</span> with {grid.confidenceScore}% AI confidence.
                </p>
              </div>

              {/* Grid PNL */}
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="text-zinc-500 text-[10px] font-mono block">TOTAL PnL (USDT)</span>
                  <span className={`text-xl font-bold font-mono tracking-tight ${currentRoiIsPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {currentRoiIsPos ? '+' : ''}{grid.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-zinc-500 text-[10px] font-mono block">ROI %</span>
                  <span className={`text-xl font-bold font-mono tracking-tight ${currentRoiIsPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {currentRoiIsPos ? '+' : ''}{grid.roiPercent.toFixed(2)}%
                  </span>
                </div>
                <button
                  onClick={() => handleStopGrid(grid.id)}
                  disabled={stoppingGridId === grid.id}
                  className="bg-rose-950/20 hover:bg-rose-900 text-rose-400 hover:text-white border border-rose-900/40 rounded px-3 py-1.5 text-xs font-mono flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  <XOctagon className="w-4 h-4" />
                  {stoppingGridId === grid.id ? 'Stopping...' : 'Terminate'}
                </button>
              </div>
            </div>

            {/* Grid Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
              <div className="bg-zinc-900/40 p-3 rounded border border-zinc-800/80">
                <span className="text-zinc-500 text-[10px]">CAPITAL & LEVERAGE</span>
                <span className="text-white font-bold block mt-1">
                  ${grid.investment.toLocaleString()} <span className="text-zinc-500 text-[10px]">USDT</span> @ {grid.leverage}x
                </span>
              </div>
              <div className="bg-zinc-900/40 p-3 rounded border border-zinc-800/80">
                <span className="text-zinc-500 text-[10px]">BOUNDS RANGE</span>
                <span className="text-zinc-300 font-semibold block mt-1">
                  {grid.lowerPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })} - {grid.upperPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </span>
              </div>
              <div className="bg-zinc-900/40 p-3 rounded border border-zinc-800/80">
                <span className="text-zinc-500 text-[10px]">SPACING PARAMETER</span>
                <span className="text-white font-semibold block mt-1">
                  {grid.spacingType === 'ATR_BASED' ? `${grid.spacingValue}x ATR` : `${(grid.spacingValue * 100).toFixed(2)}%`} ({(grid.gridSpacingPercent * 100).toFixed(2)}%)
                </span>
              </div>
              <div className="bg-zinc-900/40 p-3 rounded border border-zinc-800/80">
                <span className="text-zinc-500 text-[10px]">DYNAMIC HEGDE RATIO</span>
                <span className="text-yellow-400 font-semibold block mt-1">
                  {(grid.hedgeRatio * 100).toFixed(0)}% Allocation
                </span>
              </div>
            </div>

            {/* Visualizer SVG Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Orderbook Grid Visualizer</span>
                <span className="text-zinc-550">Live price: <span className="text-white font-bold">{livePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
              </div>
              
              {/* SVG visualization */}
              <div className="bg-zinc-950/40 border border-zinc-800 rounded p-4 relative">
                <svg className="w-full h-40" viewBox="0 0 800 160">
                  {/* Background grid lines */}
                  <line x1="0" y1="20" x2="800" y2="20" stroke="#27272a" strokeWidth="1" strokeDasharray="3" />
                  <line x1="0" y1="140" x2="800" y2="140" stroke="#27272a" strokeWidth="1" strokeDasharray="3" />
                  <line x1="0" y1="80" x2="800" y2="80" stroke="#27272a" strokeWidth="1" />

                  {/* Draw each level as horizontal lines inside bounds */}
                  {levels.map((lvl, index) => {
                    const priceRange = grid.upperPrice - grid.lowerPrice;
                    // Normalized Y position: upperPrice is top (Y=20), lowerPrice is bottom (Y=140)
                    const percent = priceRange > 0 ? (lvl.price - grid.lowerPrice) / priceRange : 0.5;
                    const y = 140 - (percent * 120);

                    const isBuy = lvl.side === 'BUY';
                    const isFilled = lvl.status === 'FILLED';
                    
                    const strokeColor = isFilled 
                      ? '#3f3f46' 
                      : isBuy ? '#10b981' : '#ef4444';

                    return (
                      <g key={lvl.id}>
                        <line 
                          x1="50" 
                          y1={y} 
                          x2="750" 
                          y2={y} 
                          stroke={strokeColor} 
                          strokeWidth={isFilled ? "1.2" : "1.8"} 
                          strokeDasharray={isFilled ? "1" : isBuy ? "4" : "0"} 
                          className="transition-all duration-300"
                        />
                        <circle 
                          cx="60" 
                          cy={y} 
                          r={3.5} 
                          fill={strokeColor} 
                        />
                        <text 
                          x="70" 
                          y={y + 4} 
                          fill={isFilled ? '#52525b' : '#a1a1aa'} 
                          fontSize="9" 
                          fontFamily="var(--font-mono)"
                        >
                          {lvl.price.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </text>
                        <text 
                          x="740" 
                          y={y + 4} 
                          fill={strokeColor} 
                          fontSize="8" 
                          fontFamily="var(--font-mono)" 
                          textAnchor="end"
                        >
                          {isFilled ? 'FILLED' : lvl.side}
                        </text>
                      </g>
                    );
                  })}

                  {/* Current Live Price Horizontal Overlay */}
                  {indicators && (
                    (() => {
                      const priceRange = grid.upperPrice - grid.lowerPrice;
                      const percent = priceRange > 0 ? (indicators.lastPrice - grid.lowerPrice) / priceRange : 0.5;
                      const y = Math.max(10, Math.min(150, 140 - (percent * 120)));
                      
                      return (
                        <g>
                          <line 
                            x1="0" 
                            y1={y} 
                            x2="800" 
                            y2={y} 
                            stroke="#e4e4e7" 
                            strokeWidth="1.5" 
                            strokeDasharray="2"
                          />
                          <rect 
                            x="360" 
                            y={y - 10} 
                            width="90" 
                            height="18" 
                            rx="3" 
                            fill="#e4e4e7" 
                          />
                          <text 
                            x="405" 
                            y={y + 3} 
                            fill="#09090b" 
                            fontSize="9" 
                            fontFamily="var(--font-mono)" 
                            textAnchor="middle" 
                            fontWeight="bold"
                          >
                            Live ${indicators.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          </text>
                        </g>
                      );
                    })()
                  )}
                </svg>

                <div className="flex justify-between items-center mt-2 px-1 text-[9px] font-mono text-zinc-550">
                  <span>LOWER BOUND: ${grid.lowerPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                  <span>ACTIVE GRID COVERAGE BOUNDS</span>
                  <span>UPPER BOUND: ${grid.upperPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                </div>
              </div>
            </div>

            {/* AI Explanation / Reasoning */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-3 rounded text-xs leading-relaxed flex gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-mono text-[10px] text-zinc-500 uppercase block">AI Operational Logic</span>
                <p className="text-zinc-300">{grid.reasoning}</p>
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
}
