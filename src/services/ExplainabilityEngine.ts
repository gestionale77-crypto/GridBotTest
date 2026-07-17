import { ExplanationReport, StrategyType, MarketRegime } from '../types.js';

export class ExplainabilityEngine {
  private static instance: ExplainabilityEngine;

  private constructor() {}

  public static getInstance(): ExplainabilityEngine {
    if (!ExplainabilityEngine.instance) {
      ExplainabilityEngine.instance = new ExplainabilityEngine();
    }
    return ExplainabilityEngine.instance;
  }

  /**
   * Generates a fully populated Explanation Audit Report
   */
  public generateReport(params: {
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
    indicatorsUsed: Record<string, number | string>;
  }): ExplanationReport {
    const decisionId = `DEC-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    return {
      decisionId,
      timestamp: new Date().toISOString(),
      symbol: params.symbol,
      strategyType: params.strategyType,
      reason: params.reason,
      confidence: params.confidence,
      riskScore: params.riskScore,
      marketRegime: params.marketRegime,
      expectedRoi: params.expectedRoi,
      expectedDrawdown: params.expectedDrawdown,
      expectedHoldingTime: params.expectedHoldingTime,
      whyNotAlternative: params.whyNotAlternative,
      sourcesUsed: ['HYPERLIQUID ORDERBOOK L2', 'HYPERLIQUID TICKER API', 'GEMINI MODEL INFERENCE', 'ATR INDICATOR COMPILER'],
      indicatorsUsed: params.indicatorsUsed,
      aiVersion: 'Gemini-3.5-Pro-IAQTS-v1.0'
    };
  }
}
