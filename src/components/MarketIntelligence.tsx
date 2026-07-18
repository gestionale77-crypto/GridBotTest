import React, { useEffect, useState, useRef } from 'react';
import { MarketIndicators, RiskProfile } from '../types.js';
import { 
  Activity, ShieldCheck, Flame, Cpu, TrendingUp, TrendingDown, RefreshCw, 
  BarChart2, BookOpen, Filter, Search, Brain, Zap, Award, Layers, Grid, 
  ChevronRight, Star, Sparkles, AlertTriangle, Info, Clock, CheckCircle2, XCircle,
  ArrowUpRight, ArrowDownRight, Compass, Play
} from 'lucide-react';

interface Props {
  symbol: string;
  onIndicatorsLoaded?: (indicators: MarketIndicators) => void;
}

export default function MarketIntelligence({ symbol, onIndicatorsLoaded }: Props) {
  const [indicators, setIndicators] = useState<MarketIndicators | null>(null);
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);
  const [newsSentiment, setNewsSentiment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mathematical Multi-Model Matrix States
  const [mathMatrix, setMathMatrix] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Indicator for 8-Level Quant Detail Pane
  const [selectedIndicator, setSelectedIndicator] = useState<any | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [matrixRes, riskRes] = await Promise.all([
        fetch(`/api/mathematical-matrix?symbol=${symbol}`),
        fetch(`/api/risk-profile?symbol=${symbol}`)
      ]);

      if (!matrixRes.ok || !riskRes.ok) {
        throw new Error('Failed to retrieve live market metrics');
      }

      const matrixType = matrixRes.headers.get('content-type');
      const riskType = riskRes.headers.get('content-type');
      if (!matrixType || !matrixType.includes('application/json') || !riskType || !riskType.includes('application/json')) {
        throw new Error('Response is not JSON');
      }

      const matrixData = await matrixRes.json();
      const riskData = await riskRes.json();

      setIndicators(matrixData.indicators);
      setRiskProfile(riskData);
      setMathMatrix(matrixData.matrix || []);
      
      if (matrixData.sentiment) {
        setNewsSentiment({
          sentiment: matrixData.sentiment,
          news: matrixData.news || []
        });
      }

      if (onIndicatorsLoaded && matrixData.indicators) {
        onIndicatorsLoaded(matrixData.indicators);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading live metrics');
    } finally {
      setLoading(false);
    }
  };

  const getMarketRegime = () => {
    if (!mathMatrix || mathMatrix.length === 0) return 'SIDEWAYS';
    const bullishCount = mathMatrix.filter(m => m.status === 'BULLISH').length;
    const bearishCount = mathMatrix.filter(m => m.status === 'BEARISH').length;
    const total = mathMatrix.length;

    const bullRatio = bullishCount / total;
    const bearRatio = bearishCount / total;

    if (bullRatio > 0.55) return 'BULLISH_TREND';
    if (bearRatio > 0.55) return 'BEARISH_TREND';
    if (indicators && indicators.atr > 450) return 'LIQUIDATION_PANIC';
    if (bullRatio > 0.4 && bearRatio > 0.4) return 'SQUEEZE_CONGESTION';
    return 'SIDEWAYS';
  };

  useEffect(() => {
    fetchMetrics();
    // Poll metrics every 2 seconds for live institutional updates
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, [symbol]);

  // Draw the CVD and Order Book Imbalance visualization on a custom high-end canvas
  useEffect(() => {
    if (!indicators || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.parentElement?.clientWidth ? canvas.parentElement.clientWidth * dpr : 350 * dpr;
    canvas.height = 80 * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '80px';
    ctx.scale(dpr, dpr);

    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // --- Draw Order Book Imbalance Gauge (-1.0 to 1.0) ---
    const imbalance = indicators.orderBookImbalance; // e.g. 0.25 (buyer dominate)
    const midX = w / 2;
    
    // Background bar
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.roundRect(15, h / 2 - 12, w - 30, 24, 6);
    ctx.fill();

    // Center marker
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(midX, h / 2 - 16);
    ctx.lineTo(midX, h / 2 + 16);
    ctx.stroke();

    // Imbalance Fill
    const fillWidth = (midX - 15) * Math.abs(imbalance);
    if (imbalance > 0) {
      // Bullish - green fill to the right
      const grad = ctx.createLinearGradient(midX, 0, midX + fillWidth, 0);
      grad.addColorStop(0, '#10b98115');
      grad.addColorStop(1, '#10b981');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(midX, h / 2 - 12, fillWidth, 24, [0, 6, 6, 0]);
      ctx.fill();
    } else {
      // Bearish - red fill to the left
      const grad = ctx.createLinearGradient(midX - fillWidth, 0, midX, 0);
      grad.addColorStop(0, '#ef4444');
      grad.addColorStop(1, '#ef444415');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(midX - fillWidth, h / 2 - 12, fillWidth, 24, [6, 0, 0, 6]);
      ctx.fill();
    }

    // Draw Labels
    ctx.font = '11px var(--font-mono)';
    ctx.fillStyle = '#71717a';
    ctx.fillText('SELLERS (Asks)', 15, h / 2 - 18);
    
    ctx.fillStyle = '#71717a';
    const buyLabel = 'BUYERS (Bids)';
    const buyLabelWidth = ctx.measureText(buyLabel).width;
    ctx.fillText(buyLabel, w - 15 - buyLabelWidth, h / 2 - 18);

    // Dynamic percent text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px var(--font-mono)';
    const percentText = `${imbalance > 0 ? '+' : ''}${(imbalance * 100).toFixed(1)}% Imbalance`;
    const textWidth = ctx.measureText(percentText).width;
    ctx.fillText(percentText, midX - textWidth / 2, h / 2 + 5);

  }, [indicators]);

  if (loading && !indicators) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 flex flex-col items-center justify-center min-h-[300px]">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
        <p className="text-zinc-400 text-sm font-mono">Syncing Hyperliquid Real-time Market Nodes...</p>
      </div>
    );
  }

  if (error || !indicators) {
    return (
      <div className="bg-zinc-950 border border-rose-950/60 rounded-lg p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-rose-400 font-mono text-sm mb-2">Error connecting to Hyperliquid server:</div>
        <p className="text-zinc-500 text-xs text-center max-w-md">{error || 'Could not fetch indicators.'}</p>
        <button onClick={fetchMetrics} className="mt-4 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-mono px-4 py-2 rounded border border-zinc-800 transition">
          Reconnect Live Feeds
        </button>
      </div>
    );
  }

  const isUp = indicators.lastPrice >= indicators.bbands.middle;

  return (
    <div id="market-intel-section" className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-2xl">
      {/* Panel Header */}
      <div className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-emerald-500" />
          <h2 className="font-display font-semibold text-white tracking-tight text-sm uppercase">Multi-Agent Quant Architecture</h2>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded text-[10px] font-mono text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          LIVE DDC SYNCED
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Architecture Diagram */}
        <div className="bg-zinc-900/20 border border-zinc-800/80 p-4 rounded-lg font-mono text-[9px] sm:text-[10px] text-emerald-500 flex justify-center text-center leading-relaxed">
          <pre className="opacity-90">
{`                   MARKET DATA                   
                        |                        
-------------------------------------------------
|        |          |            |              |
5m AI  1h AI      6h AI   Derivatives AI   Risk AI
                        |                        
                  NEWS AI ENGINE                 
                        |                        
              MASTER DECISION ENGINE             `}
          </pre>
        </div>

        {/* Big Prices */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-lg flex flex-col justify-between">
            <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider">Spot Price ({indicators.symbol})</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white tracking-tight">
                {indicators.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className={`text-xs font-mono flex items-center ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isUp ? <TrendingUp className="w-3.5 h-3.5 inline mr-0.5" /> : <TrendingDown className="w-3.5 h-3.5 inline mr-0.5" />}
                {isUp ? 'BULLISH' : 'BEARISH'}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-zinc-500 font-mono">
              24h High: {indicators.high24h.toLocaleString()} | Low: {indicators.low24h.toLocaleString()}
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-lg flex flex-col justify-between">
            <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider">Average True Range (ATR 14)</span>
            <div className="mt-2">
              <span className="text-2xl font-bold font-mono text-white tracking-tight">
                {indicators.atr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-zinc-400 text-xs font-mono ml-2">
                ({((indicators.atr / indicators.lastPrice) * 100).toFixed(2)}%)
              </span>
            </div>
            <div className="mt-1 text-[10px] text-zinc-500 font-mono">
              Volatility volatility coefficient is highly robust
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-lg flex flex-col justify-between">
            <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider">Relative Strength Index (RSI 14)</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-white tracking-tight">
                {indicators.rsi.toFixed(2)}
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${indicators.rsi > 70 ? 'bg-rose-950 text-rose-400' : indicators.rsi < 30 ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-900 text-zinc-400'}`}>
                {indicators.rsi > 70 ? 'OVERBOUGHT' : indicators.rsi < 30 ? 'OVERSOLD' : 'NEUTRAL'}
              </span>
            </div>
            <div className="mt-1 w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${indicators.rsi}%` }}></div>
            </div>
          </div>
        </div>

        {/* Bollinger Bands and CVD Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-xs font-mono">Bollinger Bands Coverage</span>
              <span className="text-zinc-550 text-[10px] font-mono">Width: {(indicators.bbands.width * 100).toFixed(2)}%</span>
            </div>
            <div className="space-y-1 text-xs font-mono text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500">Upper Band:</span>
                <span>{indicators.bbands.upper.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800/60 pt-1">
                <span className="text-zinc-500">SMA Middle:</span>
                <span className="text-zinc-400">{indicators.bbands.middle.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800/60 pt-1">
                <span className="text-zinc-500">Lower Band:</span>
                <span>{indicators.bbands.lower.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-lg space-y-3">
            <span className="text-zinc-400 text-xs font-mono block">Derivatives Indicators (Perp Swap Nodes)</span>
            <div className="space-y-1 text-xs font-mono text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500">Funding Rate:</span>
                <span className={indicators.fundingRate > 0.0002 ? 'text-amber-500' : 'text-emerald-400'}>
                  {(indicators.fundingRate * 100).toFixed(4)}%
                </span>
              </div>
              <div className="flex justify-between border-t border-zinc-800/60 pt-1">
                <span className="text-zinc-500">Open Interest:</span>
                <span>{indicators.openInterest.toLocaleString()} CONT</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800/60 pt-1">
                <span className="text-zinc-500">Cumulative Volume Delta:</span>
                <span className={indicators.cvd > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {indicators.cvd > 0 ? '+' : ''}{Math.round(indicators.cvd).toLocaleString()} Vol
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Depth Orderbook imbalance gauge */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-mono flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-emerald-500" /> Order Book Depth Imbalance Ratio (Top 10 Levels)
            </span>
          </div>
          <canvas ref={canvasRef} className="w-full h-20 rounded bg-zinc-950/50" />
        </div>

        {/* Risk Assessment Node */}
        {riskProfile && (
          <div className={`border p-4 rounded flex flex-col md:flex-row md:items-center justify-between gap-4 ${riskProfile.status === 'CRITICAL' ? 'bg-rose-950/20 border-rose-900/50 text-rose-200' : riskProfile.status === 'WARNING' ? 'bg-amber-950/15 border-amber-900/40 text-amber-200' : 'bg-zinc-900/40 border-zinc-800'}`}>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-5 h-5 ${riskProfile.status === 'CRITICAL' ? 'text-rose-400' : riskProfile.status === 'WARNING' ? 'text-amber-400' : 'text-emerald-400'}`} />
                <span className="font-semibold text-sm text-white tracking-tight">Institutional Safety Margin Assessment</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${riskProfile.status === 'CRITICAL' ? 'bg-rose-900/40 text-rose-300' : riskProfile.status === 'WARNING' ? 'bg-amber-900/40 text-amber-300' : 'bg-zinc-850 text-zinc-300'}`}>
                  {riskProfile.status} RISK
                </span>
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed">{riskProfile.recommendation}</p>
            </div>
            
            <div className="flex items-center gap-6 min-w-[200px] justify-between md:justify-end">
              <div className="text-right">
                <span className="text-zinc-500 text-[10px] font-mono block">RISK SCORE</span>
                <span className={`text-xl font-bold font-mono ${riskProfile.riskScore > 75 ? 'text-rose-400' : riskProfile.riskScore > 45 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {riskProfile.riskScore} <span className="text-xs text-zinc-500">/ 100</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-zinc-500 text-[10px] font-mono block">COLLATERAL RATIO</span>
                <span className="text-xl font-bold font-mono text-white">
                  {riskProfile.collateralRatio.toFixed(2)}x
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Mathematical Multi-Model Matrix */}
        {mathMatrix && mathMatrix.length > 0 && (
          <div className="space-y-6">
            
            {/* 1. THE PARLIAMENT OF BIASES OVERVIEW */}
            <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-xs font-mono text-white uppercase tracking-wider">The Parliament of Biases (7 Councils • 47 Models)</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Weight-Balanced Consensus</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: 'Trend', count: 9, icon: TrendingUp, desc: 'Structural core directionals' },
                  { name: 'Oscillator', count: 10, icon: Flame, desc: 'Cyclic overextended limits' },
                  { name: 'Volatility', count: 6, icon: Activity, desc: 'Range contraction & expansion' },
                  { name: 'Derivatives', count: 7, icon: Layers, desc: 'Exchange leverage & book thicks' },
                  { name: 'Machine Learning', count: 6, icon: Cpu, desc: 'Predictive neural bias classification' },
                  { name: 'Sentiment', count: 5, icon: Sparkles, desc: 'Headline & social viral volume' },
                  { name: 'Statistical', count: 4, icon: BarChart2, desc: 'Probabilistic path projections' }
                ].map((council) => {
                  const items = mathMatrix.filter(m => m.category === council.name);
                  const bulls = items.filter(m => m.status === 'BULLISH').length;
                  const bears = items.filter(m => m.status === 'BEARISH').length;
                  const total = items.length;
                  const score = total > 0 ? (bulls - bears) / total : 0;
                  const biasText = score > 0.15 ? 'BULLISH' : score < -0.15 ? 'BEARISH' : 'NEUTRAL';

                  return (
                    <div key={council.name} className="bg-zinc-950 border border-zinc-900 rounded p-3 space-y-2.5 font-mono text-[10px] flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <council.icon className={`w-3.5 h-3.5 ${biasText === 'BULLISH' ? 'text-emerald-400' : biasText === 'BEARISH' ? 'text-rose-400' : 'text-zinc-500'}`} />
                            {council.name}
                          </span>
                          <span className={`px-1 rounded text-[8px] font-bold ${
                            biasText === 'BULLISH' 
                              ? 'bg-emerald-950/40 text-emerald-400' 
                              : biasText === 'BEARISH' 
                              ? 'bg-rose-950/40 text-rose-400' 
                              : 'bg-zinc-900 text-zinc-500'
                          }`}>
                            {biasText}
                          </span>
                        </div>
                        <span className="text-zinc-650 text-[8.5px] block leading-none">{council.desc}</span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[8px] text-zinc-500">
                          <span>{bulls} Bull</span>
                          <span>{total - bulls - bears} Neut</span>
                          <span>{bears} Bear</span>
                        </div>
                        <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden flex">
                          <div className="bg-emerald-500 h-full" style={{ width: `${total > 0 ? (bulls / total) * 100 : 0}%` }}></div>
                          <div className="bg-zinc-700 h-full" style={{ width: `${total > 0 ? ((total - bulls - bears) / total) * 100 : 0}%` }}></div>
                          <div className="bg-rose-500 h-full" style={{ width: `${total > 0 ? (bears / total) * 100 : 0}%` }}></div>
                        </div>
                      </div>

                      <div className="bg-zinc-900/30 p-1.5 rounded text-[8.5px] text-zinc-400 border border-zinc-900/50 flex justify-between">
                        <span>CONSENSUS</span>
                        <strong className={biasText === 'BULLISH' ? 'text-emerald-400' : biasText === 'BEARISH' ? 'text-rose-400' : 'text-zinc-400'}>
                          {total > 0 ? Math.round((Math.max(bulls, bears, total - bulls - bears) / total) * 100) : 0}%
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. HEATMAP MULTI-TIMEFRAME GRID */}
            <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <Grid className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-xs font-mono text-white uppercase tracking-wider">Heatmap Multi-Timeframe Matrix (Cross-Regime Alignment)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[8.5px] font-mono">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> BULLISH
                  </span>
                  <span className="flex items-center gap-1 text-zinc-500">
                    <span className="w-1.5 h-1.5 bg-zinc-700 rounded-full"></span> NEUTRAL
                  </span>
                  <span className="flex items-center gap-1 text-rose-400">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span> BEARISH
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full font-mono text-[9.5px] text-left border-collapse border border-zinc-900">
                  <thead>
                    <tr className="bg-zinc-900/40 text-zinc-500 border-b border-zinc-900">
                      <th className="px-3 py-2 border-r border-zinc-900">COUNCIL BRANCH</th>
                      {['5m', '15m', '1h', '4h', '6h', '12h', 'Daily', 'Global'].map(tf => (
                        <th key={tf} className="px-3 py-2 text-center border-r border-zinc-900">{tf.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 bg-zinc-950/20">
                    {['Trend', 'Oscillator', 'Volatility', 'Derivatives', 'Machine Learning', 'Sentiment', 'Statistical'].map(cat => (
                      <tr key={cat} className="hover:bg-zinc-900/10">
                        <td className="px-3 py-2.5 font-bold text-zinc-300 border-r border-zinc-900 uppercase tracking-tight">{cat}</td>
                        {['5m', '15m', '1h', '4h', '6h', '12h', 'Daily', 'Global'].map(tf => {
                          const matching = mathMatrix.filter(m => m.category === cat && m.timeframe === tf);
                          let cellColor = 'bg-zinc-950 text-zinc-700';
                          let cellLabel = '∅';
                          if (matching.length > 0) {
                            const bulls = matching.filter(m => m.status === 'BULLISH').length;
                            const bears = matching.filter(m => m.status === 'BEARISH').length;
                            if (bulls > bears) {
                              cellColor = 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20';
                              cellLabel = `BUY (${matching.length})`;
                            } else if (bears > bulls) {
                              cellColor = 'bg-rose-950/40 text-rose-400 border border-rose-900/20';
                              cellLabel = `SELL (${matching.length})`;
                            } else {
                              cellColor = 'bg-zinc-900/60 text-zinc-400 border border-zinc-850';
                              cellLabel = `NEUT (${matching.length})`;
                            }
                          } else {
                            // Settle fallback value using parent category bias if no model directly runs on this specific TF
                            const catBulls = mathMatrix.filter(m => m.category === cat && m.status === 'BULLISH').length;
                            const catBears = mathMatrix.filter(m => m.category === cat && m.status === 'BEARISH').length;
                            if (catBulls > catBears) {
                              cellColor = 'bg-emerald-950/10 text-emerald-500/50';
                              cellLabel = 'BUY (EXTRAP)';
                            } else if (catBears > catBulls) {
                              cellColor = 'bg-rose-950/10 text-rose-500/50';
                              cellLabel = 'SELL (EXTRAP)';
                            } else {
                              cellColor = 'bg-zinc-950 text-zinc-800';
                              cellLabel = 'NEUT (EXTRAP)';
                            }
                          }
                          return (
                            <td key={tf} className={`px-2 py-2 text-center border-r border-zinc-900 ${cellColor} transition-colors font-bold`}>
                              {cellLabel}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. DIVERGENCE & CONFLUENCE ENGINE */}
            <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-3">
                <Brain className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-xs font-mono text-white uppercase tracking-wider">Dynamic Confluence & Divergence Analysis Engine</span>
              </div>

              {(() => {
                const bulls = mathMatrix.filter(m => m.status === 'BULLISH').length;
                const bears = mathMatrix.filter(m => m.status === 'BEARISH').length;
                const total = mathMatrix.length;
                const ratio = bulls / (bulls + bears || 1);

                // Council balances
                const trendBull = mathMatrix.filter(m => m.category === 'Trend' && m.status === 'BULLISH').length;
                const trendBear = mathMatrix.filter(m => m.category === 'Trend' && m.status === 'BEARISH').length;
                const oscBull = mathMatrix.filter(m => m.category === 'Oscillator' && m.status === 'BULLISH').length;
                const oscBear = mathMatrix.filter(m => m.category === 'Oscillator' && m.status === 'BEARISH').length;
                const derivBull = mathMatrix.filter(m => m.category === 'Derivatives' && m.status === 'BULLISH').length;
                const derivBear = mathMatrix.filter(m => m.category === 'Derivatives' && m.status === 'BEARISH').length;

                let confluenceState = 'LOW CONFLUENCE';
                let divergenceFlag = 'CLEAN RECONCILIATION';
                let actionBias = 'TACTICAL WAITING';
                let analysisText = '';

                if (trendBull > trendBear && oscBear > oscBull) {
                  divergenceFlag = 'BEARISH MOMENTUM DIVERGENCE (Overbought Absorption)';
                  actionBias = 'CAUTIOUS DEPLOYMENT / REDUCE UPPER SPACING';
                  analysisText = 'The Trend Council indicates sustained bullish structure, but oscillators show severely overextended overbought thresholds. This pattern indicates potential absorption or distribution. Standard grid sizes should be compressed to limit exposure.';
                } else if (trendBear > trendBull && oscBull > oscBear) {
                  divergenceFlag = 'BULLISH MOMENTUM DIVERGENCE (Oversold Accumulation)';
                  actionBias = 'AGGRESSIVE ENTRY LIMITS / EXPAND LOWER SPACING';
                  analysisText = 'The general trend remains downward, but oversold momentum indicators are turning bullish. This signals potential bottoming or high-volume absorption. Place limit grids close to local support to capture fast mean reversion.';
                } else if (trendBull > trendBear && derivBull > derivBear) {
                  confluenceState = 'STRONG BULLISH CONFLUENCE';
                  actionBias = 'GRID EXPANSION ACTIVE / TRACK BREAKOUT';
                  analysisText = 'Both structural trend models and deep derivatives order books align on a high-conviction bullish thesis. Direct buy pressure and limit-order support provide high-fidelity safety margins for grid deployment.';
                } else if (trendBear > trendBull && derivBear > derivBull) {
                  confluenceState = 'STRONG BEARISH CONFLUENCE';
                  actionBias = 'HEDGE PROTOCOLS ENGAGED / CAP SHORT LIQUIDITY';
                  analysisText = 'Coordinated downward trends with derivatives liquidation-cascade patterns indicate imminent capitulation cascades. High short volume and net outflows recommend locking capital or reducing grid sizes.';
                } else {
                  analysisText = 'Councils are operating in balanced distribution states. No extreme directional divergence detected. Recommend standard mean-reversion grid strategies aligned with calculated Bollinger Band boundaries.';
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[10px]">
                    <div className="bg-zinc-950 p-3 rounded border border-zinc-900 space-y-1.5">
                      <span className="text-zinc-500 uppercase text-[8.5px]">CONFLUENCE MATRIX</span>
                      <div className="text-sm font-bold text-white tracking-tight">{confluenceState}</div>
                      <span className="text-zinc-400 block leading-normal">
                        Calculated alignment value is <strong className="text-zinc-300">{Math.round(ratio * 100)}%</strong> across 47 active models.
                      </span>
                    </div>

                    <div className="bg-zinc-950 p-3 rounded border border-zinc-900 space-y-1.5">
                      <span className="text-zinc-500 uppercase text-[8.5px]">DIVERGENCE THREATS</span>
                      <div className={`text-sm font-bold tracking-tight ${divergenceFlag.includes('DIVERGENCE') ? 'text-amber-400' : 'text-zinc-400'}`}>{divergenceFlag}</div>
                      <span className="text-zinc-400 block leading-normal">
                        Tracks friction indicators across different model categories (e.g. Trend vs Oscillator vs Derivatives).
                      </span>
                    </div>

                    <div className="bg-zinc-950 p-3 rounded border border-zinc-900 space-y-1.5">
                      <span className="text-zinc-500 uppercase text-[8.5px]">GRID STRATEGY ADJUSTMENT</span>
                      <div className="text-sm font-bold text-indigo-400 tracking-tight">{actionBias}</div>
                      <p className="text-zinc-450 text-[9px] leading-relaxed">
                        {analysisText}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Calculated Market Regime */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Calculated Market Regime */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-3">
                  <Grid className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-xs font-mono text-white uppercase tracking-wider">Calculated Market Regime</span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-zinc-500 text-[9px] font-mono block uppercase">Active Regime State</span>
                    <span className="text-lg font-bold font-mono text-emerald-400 flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      {getMarketRegime()}
                    </span>
                  </div>

                  <p className="text-zinc-400 text-xs font-mono leading-relaxed">
                    {getMarketRegime() === 'BULLISH_TREND' && "Market exhibits strong directional momentum. Trend-following models are given 2.5x weight multiplier. Mean-reversion indicators are heavily decayed."}
                    {getMarketRegime() === 'BEARISH_TREND' && "Aggressive downward pressure detected. Short models and funding-rate arbitrage indicators have premium weight priority."}
                    {getMarketRegime() === 'LIQUIDATION_PANIC' && "Extremely elevated ATR and volume volatility. Derivatives-based liquidation-cascade alerts are given absolute master consensus veto."}
                    {getMarketRegime() === 'SQUEEZE_CONGESTION' && "High squeeze probability under range limits. Oscillators and Order Book Imbalance ratio have premium accuracy ratings."}
                    {getMarketRegime() === 'SIDEWAYS' && "Sideways range compression. Mean-reverting oscillators and Bollinger Band edge-bounce heuristics are given highest weight bias."}
                  </p>
                </div>
              </div>

              {/* Master Consensus Meter */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-3">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-xs font-mono text-white uppercase tracking-wider">Deterministic Indicator Consensus</span>
                </div>

                <div className="space-y-3 font-mono text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 uppercase">Heuristic Bias Distribution</span>
                    <span className="text-zinc-400">
                      {mathMatrix.filter(m => m.status === 'BULLISH').length} Buy / {mathMatrix.filter(m => m.status === 'BEARISH').length} Sell / {mathMatrix.filter(m => m.status === 'NEUTRAL').length} Neutral
                    </span>
                  </div>

                  <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-emerald-500 h-full" 
                      style={{ width: `${(mathMatrix.filter(m => m.status === 'BULLISH').length / mathMatrix.length) * 100}%` }}
                      title="Bullish"
                    ></div>
                    <div 
                      className="bg-zinc-600 h-full" 
                      style={{ width: `${(mathMatrix.filter(m => m.status === 'NEUTRAL').length / mathMatrix.length) * 100}%` }}
                      title="Neutral"
                    ></div>
                    <div 
                      className="bg-rose-500 h-full" 
                      style={{ width: `${(mathMatrix.filter(m => m.status === 'BEARISH').length / mathMatrix.length) * 100}%` }}
                      title="Bearish"
                    ></div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-850 p-2.5 rounded flex justify-between items-center">
                    <div>
                      <span className="text-zinc-500 text-[9px] uppercase block">Consensus Strength</span>
                      <span className="text-sm font-bold text-white">
                        {Math.round((mathMatrix.filter(m => m.status === 'BULLISH').length / (mathMatrix.filter(m => m.status !== 'NEUTRAL').length || 1)) * 100)}%
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      mathMatrix.filter(m => m.status === 'BULLISH').length > mathMatrix.filter(m => m.status === 'BEARISH').length 
                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' 
                        : 'bg-rose-950/40 text-rose-400 border border-rose-900/30'
                    }`}>
                      {mathMatrix.filter(m => m.status === 'BULLISH').length > mathMatrix.filter(m => m.status === 'BEARISH').length ? 'BULLISH CONVERGENCE' : 'BEARISH CONVERGENCE'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Core Quantitative Indicator Matrix */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-display font-semibold text-sm text-white tracking-tight uppercase">Core Quantitative Indicator Matrix</h3>
                  </div>
                  <p className="text-zinc-500 text-[10px] font-mono leading-none uppercase">
                    47 Active Mathematical Models • Live Exchange Calculations
                  </p>
                </div>

                <div className="flex gap-2 text-[10px] font-mono">
                  <div className="bg-emerald-950/20 border border-emerald-900/30 px-2.5 py-1 rounded text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>BULLISH: <strong>{mathMatrix.filter(m => m.status === 'BULLISH').length}</strong></span>
                  </div>
                  <div className="bg-rose-950/20 border border-rose-900/30 px-2.5 py-1 rounded text-rose-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span>BEARISH: <strong>{mathMatrix.filter(m => m.status === 'BEARISH').length}</strong></span>
                  </div>
                  <div className="bg-zinc-900/30 border border-zinc-800/40 px-2.5 py-1 rounded text-zinc-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                    <span>NEUTRAL: <strong>{mathMatrix.filter(m => m.status === 'NEUTRAL').length}</strong></span>
                  </div>
                </div>
              </div>

              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-500 font-mono flex items-center gap-1 uppercase tracking-wider">
                    <Filter className="w-3 h-3 text-zinc-600" /> COUNCIL BRANCH:
                  </span>
                  
                  <div className="flex flex-wrap gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-850">
                    {['All', 'Trend', 'Oscillator', 'Volatility', 'Derivatives', 'Machine Learning', 'Sentiment', 'Statistical'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-tight transition ${selectedCategory === cat ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-850 self-start sm:self-auto">
                  <span className="text-zinc-500 font-mono mr-1 uppercase">TF:</span>
                  {['All', '5m', '15m', '1h', '4h', '6h', '12h', 'Daily', 'Global'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => setSelectedTimeframe(tf)}
                      className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase transition ${selectedTimeframe === tf ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search indicators by name or category..."
                  className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-800 rounded px-9 py-2 text-xs font-mono text-zinc-300 placeholder-zinc-700 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Indicators Table Column */}
                <div className="xl:col-span-2 border border-zinc-900 rounded overflow-hidden max-h-[420px] overflow-y-auto bg-zinc-950/50">
                  <table className="w-full text-left border-collapse font-mono text-[10px]">
                    <thead>
                      <tr className="bg-zinc-900/60 text-zinc-500 uppercase tracking-wider text-[9px] border-b border-zinc-900 sticky top-0 z-10">
                        <th className="px-4 py-3">Indicator Model</th>
                        <th className="px-4 py-3">TF</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Calculated Value</th>
                        <th className="px-4 py-3 text-right">Bias Output</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {mathMatrix
                        .filter(m => {
                          const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
                          const matchesTimeframe = selectedTimeframe === 'All' || m.timeframe === selectedTimeframe;
                          const matchesSearch = searchQuery === '' || 
                            m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            m.category.toLowerCase().includes(searchQuery.toLowerCase());
                          return matchesCategory && matchesTimeframe && matchesSearch;
                        })
                        .map((item, idx) => {
                          const isSelected = selectedIndicator && selectedIndicator.name === item.name;
                          return (
                            <tr 
                              key={idx} 
                              onClick={() => setSelectedIndicator(item)}
                              className={`hover:bg-zinc-950/30 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-950/20 border-l-2 border-l-indigo-500' : ''}`}
                            >
                              <td className="px-4 py-2.5 font-medium text-zinc-300 flex items-center gap-1.5">
                                <ChevronRight className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isSelected ? 'rotate-90 text-indigo-400' : ''}`} />
                                {item.name}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="bg-zinc-900/60 px-1.5 py-0.5 rounded text-[9px] text-zinc-400 border border-zinc-850">
                                  {item.timeframe}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-zinc-500">{item.category}</td>
                              <td className="px-4 py-2.5 font-semibold text-white">{item.value}</td>
                              <td className="px-4 py-2.5 text-right">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-tight uppercase ${
                                  item.status === 'BULLISH' 
                                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' 
                                    : item.status === 'BEARISH' 
                                    ? 'bg-rose-950/40 text-rose-400 border border-rose-900/30' 
                                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800/60'
                                }`}>
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Interactive Indicator Specs Column */}
                <div className="bg-zinc-950/80 border border-zinc-850 rounded p-4 font-mono text-[10px] flex flex-col justify-between space-y-4">
                  {selectedIndicator ? (
                    <div className="space-y-4">
                      
                      {/* Name and Header */}
                      <div className="border-b border-zinc-850 pb-2 space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="text-zinc-500 uppercase text-[9px]">Active Indicator Node</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-tight uppercase ${
                            selectedIndicator.status === 'BULLISH' 
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' 
                              : selectedIndicator.status === 'BEARISH' 
                              ? 'bg-rose-950/40 text-rose-400 border border-rose-900/30' 
                              : 'bg-zinc-900 text-zinc-500 border border-zinc-800/60'
                          }`}>
                            {selectedIndicator.status}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white tracking-tight">{selectedIndicator.name}</h4>
                        <div className="flex gap-2 text-[9px] text-zinc-500">
                          <span>CATEGORY: <strong className="text-zinc-400">{selectedIndicator.category}</strong></span>
                          <span>•</span>
                          <span>TF: <strong className="text-zinc-400">{selectedIndicator.timeframe}</strong></span>
                        </div>
                      </div>

                      {/* Formula Specification */}
                      <div className="space-y-1.5">
                        <span className="text-zinc-500 text-[9px] uppercase tracking-wider block font-bold">Mathematical Formula Specification</span>
                        <div className="bg-zinc-900/40 p-3 rounded border border-zinc-850 font-mono text-[11px] text-indigo-300 overflow-x-auto text-center py-4">
                          <code>{selectedIndicator.formula}</code>
                        </div>
                      </div>

                      {/* Quant Logic Heuristics */}
                      <div className="space-y-1.5">
                        <span className="text-zinc-500 text-[9px] uppercase tracking-wider block font-bold">Quant Logic Heuristics</span>
                        <p className="text-zinc-400 text-[11px] leading-relaxed bg-zinc-900/20 p-2.5 rounded border border-zinc-850">
                          {selectedIndicator.explanation}
                        </p>
                      </div>

                      {/* Execution Impact */}
                      <div className="space-y-1.5 border-t border-zinc-850 pt-3">
                        <span className="text-zinc-500 text-[9px] uppercase tracking-wider block font-bold">Grid Strategy Alignment</span>
                        <span className="text-zinc-500 text-[9.5px] leading-normal block">
                          When this indicator is in a <strong className="text-zinc-300">{selectedIndicator.status}</strong> state, it dynamically influences the target spacing bounds of active grids to optimize entry fills and mitigate downside risk cascades.
                        </span>
                      </div>

                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center h-full py-12 space-y-2 text-zinc-600">
                      <Compass className="w-8 h-8 text-zinc-700 animate-pulse" />
                      <span className="font-bold text-zinc-400 uppercase tracking-widest text-[9px]">Indicator Specifications</span>
                      <p className="text-[10px] max-w-[200px] leading-relaxed">
                        Click on any core mathematical indicator in the matrix to view its formal mathematical equation and quant execution logic rules.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
