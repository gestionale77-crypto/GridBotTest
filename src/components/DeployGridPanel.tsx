import React, { useState, useEffect } from 'react';
import { MarketIndicators, AIAnalysisResponse } from '../types.js';
import { 
  Cpu, 
  Shield, 
  Zap, 
  Sparkles, 
  TrendingUp, 
  RefreshCw, 
  Layers, 
  DollarSign, 
  CheckCircle, 
  Info, 
  AlertTriangle, 
  Sliders, 
  PlayCircle, 
  Eye, 
  Activity, 
  ChevronRight,
  TrendingDown,
  Target
} from 'lucide-react';

interface Props {
  symbol: string;
  onGridDeployed: () => void;
}

export default function DeployGridPanel({ symbol, onGridDeployed }: Props) {
  // Config Mode: 'advanced' (OKX custom style) or 'ai' (Gemini compiled style)
  const [panelMode, setPanelMode] = useState<'advanced' | 'ai'>('advanced');
  
  // Basic Settings
  const [investment, setInvestment] = useState<number>(1000);
  const [leverage, setLeverage] = useState<number>(10);
  const [direction, setDirection] = useState<'neutral' | 'long' | 'short'>('neutral');

  // Range & Count
  const [lowerPrice, setLowerPrice] = useState<number>(92000);
  const [upperPrice, setUpperPrice] = useState<number>(108000);
  const [gridCount, setGridCount] = useState<number>(40);
  const [gridType, setGridType] = useState<'arithmetic' | 'geometric' | 'dynamic'>('dynamic');

  // Spacing & Density
  const [spacingMode, setSpacingMode] = useState<'uniform' | 'denserCenter' | 'fibonacci' | 'atrAdaptive'>('denserCenter');
  const [centerBias, setCenterBias] = useState<number>(0.7);
  const [volatilityMultiplier, setVolatilityMultiplier] = useState<number>(1.2);

  // Sizing & Scaling
  const [orderSizeMode, setOrderSizeMode] = useState<'fixed' | 'martingale' | 'zoneScaled' | 'kelly'>('zoneScaled');
  const [strongSupportMult, setStrongSupportMult] = useState<number>(1.5);
  const [strongResistanceMult, setStrongResistanceMult] = useState<number>(0.6);

  // Profit Reinvestment
  const [reinvestProfit, setReinvestProfit] = useState<boolean>(true);
  const [reinvestPercentage, setReinvestPercentage] = useState<number>(80);

  // Risk Parameters
  const [maxDrawdownPercent, setMaxDrawdownPercent] = useState<number>(12);
  const [stopLossPercent, setStopLossPercent] = useState<number>(8);
  const [trailingStop, setTrailingStop] = useState<boolean>(true);
  
  // Dynamic Recenter
  const [autoRecenter, setAutoRecenter] = useState<boolean>(true);
  const [recenterTriggerPercent, setRecenterTriggerPercent] = useState<number>(3.5);

  // Live calculated levels preview
  const [previewLevels, setPreviewLevels] = useState<{ price: number; side: 'BUY' | 'SELL'; sizeUsdt: number }[]>([]);

  // AI workflow states
  const [userIntent, setUserIntent] = useState<string>('Maximize yield with moderate risk and compounds.');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    indicators: MarketIndicators;
    strategy: AIAnalysisResponse;
  } | null>(null);

  const [deploying, setDeploying] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gateway interlock checking
  const [gatewayReady, setGatewayReady] = useState(false);
  const [checklist, setChecklist] = useState<any>(null);
  const [checkingState, setCheckingState] = useState(true);

  // 1. Fetch current price on-the-fly to populate boundaries nicely
  useEffect(() => {
    const fetchMids = async () => {
      try {
        const res = await fetch('/api/market-indicators?symbol=' + symbol);
        if (res.ok) {
          const indicators = await res.json();
          const currentMid = indicators.lastPrice || 96000;
          // Set intelligent defaults centered around the live mid-price
          setLowerPrice(Math.round(currentMid * 0.90));
          setUpperPrice(Math.round(currentMid * 1.10));
        }
      } catch (err) {
        // Safe failover
      }
    };
    fetchMids();
  }, [symbol]);

  // 2. Gateway safety status interlock polling
  useEffect(() => {
    const checkState = async () => {
      try {
        const res = await fetch('/api/hl/state');
        if (res.ok) {
          const data = await res.json();
          setChecklist(data.healthChecklist);
          setGatewayReady(data.connected);
        } else {
          setGatewayReady(false);
        }
      } catch (err) {
        setGatewayReady(false);
      } finally {
        setCheckingState(false);
      }
    };

    checkState();
    const interval = setInterval(checkState, 4000);
    return () => clearInterval(interval);
  }, []);

  // 3. Dynamic Live level calculations (Live preview node)
  useEffect(() => {
    const calcPreview = () => {
      const levels: { price: number; side: 'BUY' | 'SELL'; sizeUsdt: number }[] = [];
      const mid = (lowerPrice + upperPrice) / 2;
      const step = (upperPrice - lowerPrice) / (gridCount - 1 || 1);

      for (let i = 0; i < gridCount; i++) {
        let price = lowerPrice + step * i;
        
        // Spacing tweaks
        if (spacingMode === 'denserCenter') {
          const norm = (i - (gridCount - 1) / 2) / ((gridCount - 1) / 2 || 1);
          const sign = norm < 0 ? -1 : 1;
          const warped = sign * Math.pow(Math.abs(norm), 1 + centerBias) * (upperPrice - lowerPrice) / 2;
          price = mid + warped;
        }

        const isBuy = price < mid;
        const side: 'BUY' | 'SELL' = isBuy ? 'BUY' : 'SELL';

        // Filter by direction bias
        if (direction === 'long' && !isBuy) continue;
        if (direction === 'short' && isBuy) continue;

        // Custom Sizer
        let sizeMultiplier = 1.0;
        if (orderSizeMode === 'zoneScaled') {
          const dist = Math.abs(price - mid) / mid;
          sizeMultiplier = isBuy 
            ? 1.0 + (dist * strongSupportMult)
            : 1.0 - (dist * (1.0 - strongResistanceMult));
        } else if (orderSizeMode === 'martingale') {
          sizeMultiplier = Math.pow(1.15, Math.max(0, i % 6));
        }

        levels.push({
          price: Math.round(price * 100) / 100,
          side,
          sizeUsdt: Math.round((investment / gridCount) * sizeMultiplier * 100) / 100
        });
      }

      setPreviewLevels(levels.sort((a, b) => b.price - a.price).slice(0, 8)); // Top 8 levels
    };

    calcPreview();
  }, [lowerPrice, upperPrice, gridCount, spacingMode, centerBias, orderSizeMode, strongSupportMult, strongResistanceMult, direction, investment]);

  // Submit dynamic AI analysis
  const handleAIAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (investment < 100) {
      setError('Minimum position investment capital is 100 USDT.');
      return;
    }
    try {
      setAnalyzing(true);
      setError(null);
      setSuccessMsg(false);

      const res = await fetch('/api/analyze-regime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, userIntent }),
      });

      if (!res.ok) {
        throw new Error('Failed to run AI market intelligence sweep.');
      }

      const data = await res.json();
      setAnalysisResult(data);
    } catch (err: any) {
      setError(err.message || 'Error generating AI strategy config');
    } finally {
      setAnalyzing(false);
    }
  };

  // Deploy Advanced Grid on the exchange
  const handleDeployAdvanced = async () => {
    if (investment < 100) {
      setError('Minimum position investment capital is 100 USDT.');
      return;
    }
    if (lowerPrice >= upperPrice) {
      setError('Lower Price must be strictly lower than Upper Price.');
      return;
    }

    try {
      setDeploying(true);
      setError(null);
      setSuccessMsg(false);

      const payload = {
        symbol,
        investment,
        leverage,
        direction,
        lowerPrice,
        upperPrice,
        gridCount,
        gridType,
        spacingMode,
        centerBias,
        volatilityMultiplier,
        orderSizeMode,
        zoneMultipliers: {
          strongSupport: strongSupportMult,
          neutral: 1.0,
          strongResistance: strongResistanceMult
        },
        reinvestProfit,
        reinvestPercentage,
        maxDrawdownPercent,
        stopLossPercent,
        trailingStop,
        autoRecenter,
        recenterTriggerPercent,
        filters: {
          minVolumeUSD: 5000000,
          maxFundingRate: 0.001,
          minOpenInterest: 10000000
        }
      };

      const res = await fetch('/api/hl/deploy-grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to deploy advanced grid engine.');
      }

      setSuccessMsg(true);
      if (onGridDeployed) onGridDeployed();
      setTimeout(() => setSuccessMsg(false), 6000);
    } catch (err: any) {
      setError(err.message || 'Error executing advanced grid bot.');
    } finally {
      setDeploying(false);
    }
  };

  const handleDeployAI = async () => {
    if (!analysisResult) return;
    try {
      setDeploying(true);
      setError(null);

      // Convert AI strategy to advanced payload fields
      const res = await fetch('/api/hl/deploy-grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          investment,
          leverage: analysisResult.strategy.recommendedConfig.leverage,
          direction: analysisResult.strategy.recommendedConfig.strategyMode === 'LONG_BIASED' ? 'long' : analysisResult.strategy.recommendedConfig.strategyMode === 'SHORT_BIASED' ? 'short' : 'neutral',
          lowerPrice: analysisResult.strategy.recommendedConfig.lowerPrice,
          upperPrice: analysisResult.strategy.recommendedConfig.upperPrice,
          gridCount: analysisResult.strategy.recommendedConfig.levelsCount,
          gridType: 'dynamic',
          spacingMode: 'atrAdaptive',
          centerBias: 0.5,
          volatilityMultiplier: 1.0,
          orderSizeMode: 'fixed',
          zoneMultipliers: { strongSupport: 1.0, neutral: 1.0, strongResistance: 1.0 },
          reinvestProfit: true,
          reinvestPercentage: 75,
          maxDrawdownPercent: 15,
          stopLossPercent: analysisResult.strategy.recommendedConfig.stopLossPercent ? analysisResult.strategy.recommendedConfig.stopLossPercent * 100 : 10,
          trailingStop: true,
          autoRecenter: true,
          recenterTriggerPercent: 4.0
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to deploy AI-generated strategy.');
      }

      setSuccessMsg(true);
      setAnalysisResult(null);
      if (onGridDeployed) onGridDeployed();
      setTimeout(() => setSuccessMsg(false), 6000);
    } catch (err: any) {
      setError(err.message || 'Error deploying AI grid strategy');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div id="deploy-section" className="bg-[#0b0f17] border border-[#1e293b] rounded-xl overflow-hidden shadow-2xl">
      {/* Dynamic Navigation Mode Tabs */}
      <div className="border-b border-[#1e293b] bg-[#0d1421] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h3 className="font-display text-xs font-semibold text-white tracking-widest uppercase">Grid Trading Deployment Interlock</h3>
        </div>
        <div className="flex bg-[#162235] p-1 rounded-lg border border-[#1e293b]/60">
          <button
            type="button"
            onClick={() => { setPanelMode('advanced'); setError(null); }}
            className={`px-3 py-1 text-[11px] font-mono rounded-md transition-colors ${panelMode === 'advanced' ? 'bg-[#2563eb] text-white font-bold' : 'text-gray-400 hover:text-white'}`}
          >
            <Sliders className="w-3.5 h-3.5 inline mr-1" /> OKX Advanced Grid
          </button>
          <button
            type="button"
            onClick={() => { setPanelMode('ai'); setError(null); }}
            className={`px-3 py-1 text-[11px] font-mono rounded-md transition-colors ${panelMode === 'ai' ? 'bg-[#2563eb] text-white font-bold' : 'text-gray-400 hover:text-white'}`}
          >
            <Sparkles className="w-3.5 h-3.5 inline mr-1" /> Gemini Compiler
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Interlock Safety Warning */}
        {!gatewayReady ? (
          <div className="bg-rose-950/10 border border-rose-900/40 p-5 rounded-lg space-y-4 font-mono text-xs">
            <div className="flex items-start gap-3 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <strong className="block uppercase text-[10px] tracking-wide font-bold">CRYPTO SIGNING INTERLOCK ENABLED</strong>
                <span className="leading-relaxed mt-1 block text-zinc-300">
                  Trading is safety-locked. To deploy live, cryptographically-signed orders on Hyperliquid, you must first connect your Arbitrum wallet.
                </span>
              </div>
            </div>

            {checklist && (
              <div className="bg-zinc-950 p-3 rounded border border-zinc-900 text-[10px] text-zinc-500 space-y-1.5">
                <span className="text-[9px] uppercase tracking-wider text-zinc-600 block font-bold">Verification Steps Completed:</span>
                {!checklist.restAuthenticated && <div>✗ REST Authentication: <span className="text-rose-500 font-bold">MISSING</span></div>}
                {!checklist.walletVerified && <div>✗ Wallet Address Binding: <span className="text-rose-500 font-bold">MISSING</span></div>}
                {!checklist.balanceLoaded && <div>✗ Live USDC Balance Sync: <span className="text-rose-500 font-bold">NOT LOADED</span></div>}
              </div>
            )}

            <p className="text-zinc-500 text-[11px] leading-relaxed">
              *If you do not have private keys stored, the bot will auto-fall back to <strong>Institutional Paper-Trading</strong> mode, generating high-fidelity local execution logs for debugging.
            </p>
          </div>
        ) : null}

        {/* 1. OKX ADVANCED CUSTOM GRID MODE */}
        {panelMode === 'advanced' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2.5 bg-zinc-900/40 p-3 rounded border border-zinc-800 text-xs font-mono">
              <Target className="w-4 h-4 text-[#3b82f6]" />
              <span className="text-zinc-400">Asset Node:</span>
              <span className="text-white font-bold bg-[#1e293b] px-2 py-0.5 rounded border border-[#334155]">{symbol} Perpetual Contract</span>
            </div>

            {/* Basic Grid Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Total Capital (USDC)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">$</span>
                  <input
                    type="number"
                    value={investment}
                    onChange={(e) => setInvestment(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-[#1e293b] rounded py-2 px-6 font-mono text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Leverage Ratio</label>
                <select
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="w-full bg-[#111827] border border-[#1e293b] rounded py-2 px-3 font-mono text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {[1, 2, 3, 5, 10, 20, 30, 50].map((lev) => (
                    <option key={lev} value={lev}>{lev}x Leverage</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Bias Direction</label>
                <div className="grid grid-cols-3 gap-1 bg-[#111827] p-1 border border-[#1e293b] rounded">
                  {['neutral', 'long', 'short'].map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => setDirection(dir as any)}
                      className={`py-1 text-[9px] font-mono font-bold uppercase rounded transition-colors ${direction === dir ? 'bg-[#3b82f6] text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Price Boundaries & Levels */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Lower Price Limit</label>
                <input
                  type="number"
                  value={lowerPrice}
                  onChange={(e) => setLowerPrice(Number(e.target.value))}
                  className="w-full bg-[#111827] border border-[#1e293b] rounded py-2 px-3 font-mono text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Upper Price Limit</label>
                <input
                  type="number"
                  value={upperPrice}
                  onChange={(e) => setUpperPrice(Number(e.target.value))}
                  className="w-full bg-[#111827] border border-[#1e293b] rounded py-2 px-3 font-mono text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Grid Levels Count (2-400)</label>
                <input
                  type="number"
                  value={gridCount}
                  onChange={(e) => setGridCount(Math.min(400, Math.max(2, Number(e.target.value))))}
                  className="w-full bg-[#111827] border border-[#1e293b] rounded py-2 px-3 font-mono text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Advanced Spacing & Center Density Sliders */}
            <div className="bg-[#0f172a]/60 border border-[#1e293b] p-4 rounded-lg space-y-4">
              <span className="text-[11px] font-mono text-indigo-400 font-bold uppercase tracking-wider block">1. Adaptive Spacing & Density</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-2">Spacing Distribution Model</label>
                  <select
                    value={spacingMode}
                    onChange={(e) => setSpacingMode(e.target.value as any)}
                    className="w-full bg-[#111827] border border-[#1e293b] rounded py-1.5 px-2.5 font-mono text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="uniform">Uniform (OKX Standard)</option>
                    <option value="denserCenter">Denser Center (Normal-Sigmoid Density)</option>
                    <option value="fibonacci">Fibonacci Sequence Levels</option>
                    <option value="atrAdaptive">ATR Adaptive (Volatility Spaced)</option>
                  </select>
                </div>

                {spacingMode === 'denserCenter' && (
                  <div>
                    <label className="flex justify-between text-[10px] font-mono text-zinc-400 mb-2">
                      <span>Center bias Concentration:</span>
                      <span className="text-white font-bold">{(centerBias * 100).toFixed(0)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1.5"
                      step="0.1"
                      value={centerBias}
                      onChange={(e) => setCenterBias(parseFloat(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Order Sizing Algorithms */}
            <div className="bg-[#0f172a]/60 border border-[#1e293b] p-4 rounded-lg space-y-4">
              <span className="text-[11px] font-mono text-indigo-400 font-bold uppercase tracking-wider block">2. Size Distribution Engine</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-2">Order Sizing Mode</label>
                  <select
                    value={orderSizeMode}
                    onChange={(e) => setOrderSizeMode(e.target.value as any)}
                    className="w-full bg-[#111827] border border-[#1e293b] rounded py-1.5 px-2.5 font-mono text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="fixed">Fixed Size (Equal Capital)</option>
                    <option value="martingale">Martingale (Multiply size on depth)</option>
                    <option value="zoneScaled">Zone-Scaled (Support/Resistance biased)</option>
                    <option value="kelly">Kelly Criterion Scaling</option>
                  </select>
                </div>

                {orderSizeMode === 'zoneScaled' && (
                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <label className="flex justify-between text-[10px] text-zinc-400 mb-1">
                        <span>Support Size Multiplier:</span>
                        <span className="text-emerald-400 font-bold">{strongSupportMult}x</span>
                      </label>
                      <input
                        type="range"
                        min="1.0"
                        max="3.0"
                        step="0.1"
                        value={strongSupportMult}
                        onChange={(e) => setStrongSupportMult(parseFloat(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="flex justify-between text-[10px] text-zinc-400 mb-1">
                        <span>Resistance Size Multiplier:</span>
                        <span className="text-rose-400 font-bold">{strongResistanceMult}x</span>
                      </label>
                      <input
                        type="range"
                        min="0.2"
                        max="1.0"
                        step="0.1"
                        value={strongResistanceMult}
                        onChange={(e) => setStrongResistanceMult(parseFloat(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Yield Reinvestment Compound */}
            <div className="bg-[#0f172a]/60 border border-[#1e293b] p-4 rounded-lg space-y-4">
              <span className="text-[11px] font-mono text-indigo-400 font-bold uppercase tracking-wider block">3. Capital Reinvestment Compound (reinvest)</span>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="reinvestCheck"
                    checked={reinvestProfit}
                    onChange={(e) => setReinvestProfit(e.target.checked)}
                    className="w-4 h-4 rounded border-[#1e293b] text-blue-500 focus:ring-0 bg-[#111827] cursor-pointer"
                  />
                  <label htmlFor="reinvestCheck" className="text-zinc-300 font-bold cursor-pointer">
                    Enable Auto-Compound Yield
                  </label>
                </div>

                {reinvestProfit && (
                  <div className="flex-1 max-w-xs">
                    <div className="flex justify-between mb-1.5 text-[10px] text-zinc-400">
                      <span>Reinvest Percentage:</span>
                      <span className="text-blue-400 font-bold">{reinvestPercentage}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={reinvestPercentage}
                      onChange={(e) => setReinvestPercentage(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Risk controls & auto recenter */}
            <div className="bg-[#0f172a]/60 border border-[#1e293b] p-4 rounded-lg space-y-4">
              <span className="text-[11px] font-mono text-indigo-400 font-bold uppercase tracking-wider block">4. Risk Guards & Recenter Interlock</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1.5">Emergency Drawdown Kill-Switch (%)</label>
                  <input
                    type="number"
                    value={maxDrawdownPercent}
                    onChange={(e) => setMaxDrawdownPercent(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-[#1e293b] rounded py-1.5 px-3 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1.5">Max Stop Loss Threshold (%)</label>
                  <input
                    type="number"
                    value={stopLossPercent}
                    onChange={(e) => setStopLossPercent(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-[#1e293b] rounded py-1.5 px-3 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-[#1e293b]/60 pt-3 flex flex-col sm:flex-row justify-between gap-4 font-mono text-xs">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="recenterCheck"
                    checked={autoRecenter}
                    onChange={(e) => setAutoRecenter(e.target.checked)}
                    className="w-4 h-4 rounded border-[#1e293b] text-blue-500 focus:ring-0 bg-[#111827] cursor-pointer"
                  />
                  <label htmlFor="recenterCheck" className="text-zinc-300 font-bold cursor-pointer">
                    Enable Dynamic Auto-Recentering
                  </label>
                </div>

                {autoRecenter && (
                  <div className="flex-1 max-w-xs">
                    <div className="flex justify-between mb-1.5 text-[10px] text-gray-400">
                      <span>Trigger deviation:</span>
                      <span className="text-blue-400 font-bold">{recenterTriggerPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="10.0"
                      step="0.5"
                      value={recenterTriggerPercent}
                      onChange={(e) => setRecenterTriggerPercent(parseFloat(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Real-time pre-deployment levels calculated visualizer */}
            <div className="bg-[#0b101b] border border-[#1e293b] p-4 rounded-lg font-mono text-[11px] space-y-3">
              <span className="text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-gray-400" /> Real-time Calculated Order Preview (Non-uniform)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {previewLevels.map((lvl, index) => (
                  <div key={index} className="bg-[#111a2e] p-2.5 rounded border border-[#1e293b]/50 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-[9px]">Lvl {index + 1}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${lvl.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {lvl.side}
                      </span>
                    </div>
                    <div className="mt-2 text-white font-bold text-xs">${lvl.price.toLocaleString()}</div>
                    <div className="text-[9px] text-gray-400 mt-1">${lvl.sizeUsdt} Alloc</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Execution Trigger */}
            <button
              type="button"
              onClick={handleDeployAdvanced}
              disabled={deploying}
              className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-display font-medium text-sm py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-950/45"
            >
              {deploying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Deploying OKX-Style Advanced Grid Levels...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4.5 h-4.5" />
                  DEPLOY LIVE GRID ON HYPERLIQUID
                </>
              )}
            </button>
          </div>
        )}

        {/* 2. AI DYNAMIC COMPILED MODE */}
        {panelMode === 'ai' && (
          <form onSubmit={handleAIAnalysis} className="space-y-5">
            <div className="flex items-center gap-2.5 bg-zinc-900/40 p-3 rounded border border-zinc-800 text-xs font-mono">
              <Info className="w-4 h-4 text-emerald-400" />
              <span className="text-zinc-500">Targeting Spot Asset Node:</span>
              <span className="text-white font-bold bg-zinc-850 px-2 py-0.5 rounded border border-zinc-800">{symbol}</span>
            </div>

            {/* Investment Input */}
            <div className="space-y-2">
              <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider">
                Allocated Position Capital (USDT)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono">$</span>
                <input
                  type="number"
                  value={investment}
                  onChange={(e) => setInvestment(Number(e.target.value))}
                  min="100"
                  step="50"
                  className="w-full bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 focus:outline-none rounded pl-8 pr-12 py-3 text-white font-mono text-sm transition"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">USDT</span>
              </div>
            </div>

            {/* User Intent prompt box */}
            <div className="space-y-2">
              <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider">
                AI Strategy Objective (Natural Language Prompt)
              </label>
              <textarea
                value={userIntent}
                onChange={(e) => setUserIntent(e.target.value)}
                placeholder="E.g. Run the safest grid possible or Maximize yield with high leverage"
                className="w-full bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 focus:outline-none rounded p-3 text-white text-sm min-h-[80px] transition"
                required
              />
              <span className="text-[10px] text-zinc-500 block leading-normal">
                Gemini will process your words against live Hyperliquid metrics to assemble the ideal grid parameters.
              </span>
            </div>

            <button
              type="submit"
              disabled={analyzing}
              className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-display font-medium text-sm py-3 px-4 rounded flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Assembling Institutional Strategy Config...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-zinc-950" />
                  Compile Adaptive AI Strategy Config
                </>
              )}
            </button>
          </form>
        )}

        {/* Status Alerts */}
        {error && (
          <div className="mt-5 p-4 bg-rose-950/20 border border-rose-900/40 rounded text-rose-400 text-xs font-mono">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mt-5 p-4 bg-emerald-950/15 border border-emerald-900/30 rounded text-emerald-400 text-xs font-mono flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Grid Engine spawned successfully! Active levels deployed on live orderbooks.
          </div>
        )}

        {/* AI Compilation Result Sheet */}
        {panelMode === 'ai' && analysisResult && (
          <div className="mt-6 border border-zinc-800 bg-zinc-900/30 rounded p-5 space-y-5 animate-fade-in">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Dynamic AI Configuration Output
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                Confidence: <span className="text-white font-bold">{analysisResult.strategy.confidenceScore}%</span>
              </span>
            </div>

            {/* Strategy Profile Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-mono">
              <div className="bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                <span className="text-zinc-500 block text-[9px] uppercase">Strategy Type</span>
                <span className="text-emerald-400 font-bold mt-1 block uppercase">
                  {analysisResult.strategy.recommendedConfig.strategyType || 'GRID'}
                </span>
              </div>
              <div className="bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                <span className="text-zinc-500 block text-[9px] uppercase">Market Regime</span>
                <span className="text-white font-bold mt-1 block text-[10px]">
                  {analysisResult.strategy.regime.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                <span className="text-zinc-500 block text-[9px] uppercase">Strategy Mode</span>
                <span className="text-emerald-400 font-bold mt-1 block">
                  {analysisResult.strategy.recommendedConfig.strategyMode}
                </span>
              </div>
              <div className="bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                <span className="text-zinc-500 block text-[9px] uppercase">Grid Density</span>
                <span className="text-white font-bold mt-1 block flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 inline text-zinc-500" />
                  {analysisResult.strategy.recommendedConfig.levelsCount} levels
                </span>
              </div>
              <div className="bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                <span className="text-zinc-500 block text-[9px] uppercase">Target Leverage</span>
                <span className="text-orange-400 font-bold mt-1 block">
                  {analysisResult.strategy.recommendedConfig.leverage}x
                </span>
              </div>
            </div>

            {/* Spacing & Risk Profile */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                <span className="text-zinc-500 block text-[9px] uppercase">Grid Spacing</span>
                <span className="text-white font-semibold mt-1 block">
                  {analysisResult.strategy.recommendedConfig.spacingType === 'ATR_BASED'
                    ? `${analysisResult.strategy.recommendedConfig.spacingValue}x ATR`
                    : `${(analysisResult.strategy.recommendedConfig.spacingValue * 100).toFixed(2)}%`}
                </span>
              </div>
              <div className="bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                <span className="text-zinc-500 block text-[9px] uppercase">Hedge Protection Ratio</span>
                <span className="text-yellow-400 font-semibold mt-1 block">
                  {(analysisResult.strategy.recommendedConfig.hedgeRatio * 100).toFixed(0)}%
                </span>
              </div>
              <div className="bg-zinc-900/60 p-3 rounded border border-zinc-800/80 col-span-2 md:col-span-1">
                <span className="text-zinc-500 block text-[9px] uppercase">TP / SL Safety Bounds</span>
                <span className="text-zinc-300 mt-1 block text-[11px]">
                  TP: {analysisResult.strategy.recommendedConfig.takeProfitPercent ? `+${(analysisResult.strategy.recommendedConfig.takeProfitPercent * 100).toFixed(1)}%` : 'None'} | SL: {analysisResult.strategy.recommendedConfig.stopLossPercent ? `-${(analysisResult.strategy.recommendedConfig.stopLossPercent * 100).toFixed(1)}%` : 'None'}
                </span>
              </div>
            </div>

            {/* AI Reasoning Text */}
            <div className="space-y-2">
              <span className="text-xs font-mono text-zinc-500 uppercase block">AI System Assessment:</span>
              <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                {analysisResult.strategy.reasoning}
              </p>
            </div>

            {/* Deploy Trigger Button */}
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setAnalysisResult(null)}
                className="w-1/3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-mono py-3 px-4 rounded transition cursor-pointer"
              >
                Discard Config
              </button>
              <button
                type="button"
                onClick={handleDeployAI}
                disabled={deploying}
                className="w-2/3 bg-emerald-500 hover:bg-emerald-600 text-white font-display font-medium text-sm py-3 px-4 rounded flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition cursor-pointer"
              >
                {deploying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Spawning Bot levels on live price...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm & Deploy Adaptive Engine
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
