import React, { useState, useEffect } from 'react';
import { MarketIndicators, AIAnalysisResponse } from '../types.js';
import { Cpu, Shield, Zap, Sparkles, TrendingUp, RefreshCw, Layers, DollarSign, CheckCircle, Info, AlertTriangle } from 'lucide-react';

interface Props {
  symbol: string;
  onGridDeployed: () => void;
}

export default function DeployGridPanel({ symbol, onGridDeployed }: Props) {
  const [investment, setInvestment] = useState<number>(1000);
  const [userIntent, setUserIntent] = useState<string>('Maximize yield with moderate risk.');
  const [analyzing, setAnalyzing] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    indicators: MarketIndicators;
    strategy: AIAnalysisResponse;
  } | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gateway readiness status state
  const [gatewayReady, setGatewayReady] = useState(false);
  const [checklist, setChecklist] = useState<any>(null);
  const [checkingState, setCheckingState] = useState(true);

  useEffect(() => {
    const checkState = async () => {
      try {
        const res = await fetch('/api/hl/state');
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            const list = data.healthChecklist;
            const isConnected = data.connected;

            if (list) {
              setChecklist(list);
              setGatewayReady(isConnected);
            } else {
              setGatewayReady(false);
            }
          } else {
            setGatewayReady(false);
          }
        } else {
          setGatewayReady(false);
        }
      } catch (err) {
        // Suppress transient network fetch or parsing logs during server boot or redeployments
        setGatewayReady(false);
      } finally {
        setCheckingState(false);
      }
    };

    checkState();
    const interval = setInterval(checkState, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAIAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (investment < 100) {
      setError('Minimum institutional investment capital is 100 USDT.');
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
      console.error(err);
      setError(err.message || 'Error generating AI strategy config');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeploy = async () => {
    if (!analysisResult) return;
    try {
      setDeploying(true);
      setError(null);

      const res = await fetch('/api/deploy-grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          investment,
          userIntent,
          aiStrategy: analysisResult.strategy,
        }),
      });

      if (!res.ok) {
        throw new Error('Error spawning grid executor on Hyperliquid market node');
      }

      setSuccessMsg(true);
      setAnalysisResult(null);
      onGridDeployed();
      
      // Clear inputs
      setTimeout(() => setSuccessMsg(false), 5000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error deploying grid');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div id="deploy-section" className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Cpu className="w-5 h-5 text-emerald-500" />
          <h2 className="font-display font-semibold text-white tracking-tight text-sm uppercase">AI Strategy Compiler & Deployer</h2>
        </div>
        <div className="text-[10px] font-mono text-zinc-500 uppercase">
          Gemini 3.5 Engine
        </div>
      </div>

      <div className="p-6">
        {!gatewayReady ? (
          <div className="bg-rose-950/15 border border-rose-900/40 p-5 rounded-lg space-y-4 font-mono text-xs">
            <div className="flex items-start gap-3 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <strong className="block uppercase text-[10px] tracking-wide font-bold">GATEWAY SAFETY INTERLOCK ACTIVE</strong>
                <span className="leading-relaxed mt-1 block text-zinc-300">
                  Trading functions are locked. Before compiling or deploying AI strategy nodes, you must fully authenticate and synchronize your real Hyperliquid account.
                </span>
              </div>
            </div>

            {checklist && (
              <div className="bg-zinc-950 p-3 rounded border border-zinc-900 text-[10px] text-zinc-500 space-y-1.5">
                <span className="text-[9px] uppercase tracking-wider text-zinc-600 block font-bold">Interlock Status Check:</span>
                {!checklist.restAuthenticated && <div>✗ REST Authentication Status: <span className="text-rose-500 font-bold">PENDING</span></div>}
                {!checklist.walletVerified && <div>✗ Arbitrum Wallet Verification: <span className="text-rose-500 font-bold">PENDING</span></div>}
                {!checklist.balanceLoaded && <div>✗ Live USDC Balance Status: <span className="text-rose-500 font-bold">NOT LOADED</span></div>}
                {!checklist.positionsLoaded && <div>✗ Perpetual Positions Status: <span className="text-rose-500 font-bold">NOT LOADED</span></div>}
              </div>
            )}

            <p className="text-zinc-500 text-[11px] leading-relaxed pt-1">
              Please navigate to the <strong>Hyperliquid Connection</strong> panel to enter your Arbitrum Wallet Address and synchronize the Gateway.
            </p>
          </div>
        ) : (
          <form onSubmit={handleAIAnalysis} className="space-y-5">
            {/* Symbol Indicator info */}
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

        {error && (
          <div className="mt-5 p-4 bg-rose-950/20 border border-rose-900/40 rounded text-rose-400 text-xs font-mono">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mt-5 p-4 bg-emerald-950/15 border border-emerald-900/30 rounded text-emerald-400 text-xs font-mono flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Grid Engine spawned successfully! Active levels deployed on live orderbooks.
          </div>
        )}

        {/* AI Compilation Result Sheet */}
        {analysisResult && (
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
                onClick={() => setAnalysisResult(null)}
                className="w-1/3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-mono py-3 px-4 rounded transition cursor-pointer"
              >
                Discard Config
              </button>
              <button
                onClick={handleDeploy}
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
