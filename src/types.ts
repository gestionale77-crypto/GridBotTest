/**
 * Institutional Adaptive Quantitative Trading System (IAQTS)
 * Shared Type Definitions, Regimes, Risk Metrics and Explanation Reports
 */

export type MarketRegime =
  | 'TREND_UP_LOW_VOL'
  | 'TREND_UP_HIGH_VOL'
  | 'TREND_UP_EXPANDING'
  | 'TREND_UP_EXHAUSTION'
  | 'TREND_DOWN_LOW_VOL'
  | 'TREND_DOWN_HIGH_VOL'
  | 'MEAN_REVERSION'
  | 'COMPRESSION'
  | 'VOLATILITY_EXPANSION'
  | 'FAKE_BREAKOUT'
  | 'NEWS_MODE'
  | 'PANIC'
  | 'EUPHORIA'
  | 'LOW_LIQUIDITY'
  | 'HIGH_LIQUIDITY';

export type StrategyType =
  | 'GRID'
  | 'DCA'
  | 'TWAP'
  | 'VWAP'
  | 'BASIS'
  | 'CARRY'
  | 'MM'
  | 'LP';

export interface MarketIndicators {
  symbol: string;
  lastPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  atr: number;           // Average True Range (calculated on server)
  rsi: number;           // Relative Strength Index (calculated on server)
  bbands: {
    upper: number;
    middle: number;
    lower: number;
    width: number;
  };
  fundingRate: number;   // From Hyperliquid Public API
  openInterest: number;  // From Hyperliquid Public API
  orderBookImbalance: number; // Ratio of asks to bids in top depth (-1.0 to 1.0)
  cvd: number;           // Cumulative Volume Delta
  timestamp: string;
}

export interface StrategyConfig {
  id: string;
  status: 'ACTIVE' | 'STOPPED' | 'PAUSED';
  symbol: string;
  strategyType: StrategyType;
  regime: MarketRegime;
  strategyMode: 'SYMMETRIC' | 'LONG_BIASED' | 'SHORT_BIASED' | 'DYNAMIC_HEDGED' | 'DEFENSIVE';
  levelsCount: number;
  lowerPrice: number;
  upperPrice: number;
  spacingType: 'ATR_BASED' | 'VOLATILITY_BASED' | 'FIXED_PERCENT';
  spacingValue: number;    // Spacing size (coefficient or percentage)
  gridSpacingPercent: number; // calculated spacing as percentage
  investment: number;      // USDT
  leverage: number;        // e.g. 1x, 3x, 5x, 10x
  stopLoss: number | null;
  takeProfit: number | null;
  hedgeRatio: number;      // percentage of size allocated to opposite direction hedging
  confidenceScore: number; // 0 to 100%
  reasoning: string;       // AI Explanation
  createdAt: string;
  updatedAt: string;
  totalPnL: number;
  roiPercent: number;
}

// Retain alias for UI components during migration phase
export type GridConfig = StrategyConfig;

export interface StrategyLevel {
  id: string;
  strategyId: string;
  price: number;
  side: 'BUY' | 'SELL';
  size: number; // size in base crypto (BTC, ETH, etc.)
  sizeUsdt: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  executionPolicy: string; // post-only, IOC, passive limit etc.
  filledAt: string | null;
  orderId: string | null;
  txSignature: string | null; // Exchange transaction signature
}

// Retain alias for UI components during migration phase
export type GridLevel = StrategyLevel;

// Trade Memory
export interface TradeLog {
  id: string;
  strategyId: string; // mapped from gridId
  timestamp: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  amount: number;
  amountUsdt: number;
  fee: number; // in USDT
  profitLoss: number; // realized PnL
  txSignature: string; // verifiable exchange signature
  type: 'GRID_ENTRY' | 'GRID_EXIT' | 'HEDGE_ENTRY' | 'HEDGE_EXIT' | 'LIQUIDATION_PROTECTION' | 'STOP_LOSS' | 'TAKE_PROFIT';
  marketRegime: MarketRegime;
}

export interface RiskProfile {
  marginUsagePercent: number; // 0 - 100
  distanceToLiquidationPercent: number; // 0 - 100 (high is safer)
  riskScore: number; // 1 - 100 (high is riskier)
  liquidationPrice: number | null;
  collateralRatio: number;
  status: 'SAFE' | 'WARNING' | 'CRITICAL';
  recommendation: string;
}

// Market Memory Snapshot
export interface MarketSnapshot {
  id: string;
  timestamp: string;
  symbol: string;
  price: number;
  atr: number;
  fundingRate: number;
  openInterest: number;
  imbalance: number;
  volatility: number;
}

// Explainability Engine Report
export interface ExplanationReport {
  decisionId: string;
  timestamp: string;
  symbol: string;
  strategyType: StrategyType;
  reason: string;
  confidence: number;
  riskScore: number;
  marketRegime: MarketRegime;
  expectedRoi: number;
  expectedDrawdown: number;
  expectedHoldingTime: string;
  whyNotAlternative: string;
  sourcesUsed: string[];
  indicatorsUsed: Record<string, number | string>;
  aiVersion: string;
}

export interface IAQTSEngineState {
  activeGrids: StrategyConfig[];
  gridLevels: Record<string, StrategyLevel[]>; // strategyId -> levels
  historicalGrids: StrategyConfig[];
  trades: TradeLog[];
  marketIndicators: Record<string, MarketIndicators>;
  riskProfiles: Record<string, RiskProfile>;
}

// Maintain previous state shape for UI backwards compatibility
export type AIGEngineState = IAQTSEngineState;

export interface AIAnalysisResponse {
  regime: MarketRegime;
  confidenceScore: number;
  reasoning: string;
  recommendedConfig: {
    strategyType: StrategyType;
    strategyMode: 'SYMMETRIC' | 'LONG_BIASED' | 'SHORT_BIASED' | 'DYNAMIC_HEDGED' | 'DEFENSIVE';
    levelsCount: number;
    spacingType: 'ATR_BASED' | 'VOLATILITY_BASED' | 'FIXED_PERCENT';
    spacingValue: number;
    leverage: number;
    stopLossPercent: number | null;
    takeProfitPercent: number | null;
    hedgeRatio: number;
  };
}
