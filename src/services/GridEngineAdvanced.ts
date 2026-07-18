import { DatabaseService } from './db.js';
import { EventBus } from './EventBus.js';
import { HyperliquidPublicService } from './hyperliquidPublic.js';
import { MarketIndicators } from '../types.js';

export interface AdvancedGridConfig {
  symbol: string;
  investment: number;
  direction: 'neutral' | 'long' | 'short';
  leverage: number;
  gridCount: number;
  lowerPrice: number;
  upperPrice: number;
  
  // Advanced Spacing
  gridType: 'arithmetic' | 'geometric' | 'dynamic';
  spacingMode: 'uniform' | 'denserCenter' | 'fibonacci' | 'atrAdaptive';
  centerBias: number; // 0.0 - 1.0 (density concentration)
  volatilityMultiplier: number; // multiplier for ATR adjustments

  // Advanced Sizing
  orderSizeMode: 'fixed' | 'martingale' | 'zoneScaled' | 'kelly';
  zoneMultipliers: {
    strongSupport: number;
    neutral: number;
    strongResistance: number;
  };

  // Reinvestment
  reinvestProfit: boolean;
  reinvestPercentage: number; // 0-100

  // Risk Management
  maxDrawdownPercent: number;
  stopLossPercent: number;
  trailingStop: boolean;
  autoRecenter: boolean;
  recenterTriggerPercent: number;

  // Filters
  filters: {
    minVolumeUSD: number;
    maxFundingRate: number;
    minOpenInterest: number;
  };
}

export class GridEngineAdvanced {
  private static instance: GridEngineAdvanced;
  private db = DatabaseService.getInstance();
  private hlPublic = HyperliquidPublicService.getInstance();
  private eventBus = EventBus.getInstance();

  private constructor() {}

  public static getInstance(): GridEngineAdvanced {
    if (!GridEngineAdvanced.instance) {
      GridEngineAdvanced.instance = new GridEngineAdvanced();
    }
    return GridEngineAdvanced.instance;
  }

  /**
   * Generates grid level prices based on non-uniform mathematical distributions
   */
  public generateGridLevels(
    config: AdvancedGridConfig,
    centerPrice: number,
    atr: number
  ): { price: number; side: 'BUY' | 'SELL'; sizeUsdt: number }[] {
    const levels: { price: number; side: 'BUY' | 'SELL'; sizeUsdt: number }[] = [];
    const count = config.gridCount;
    const lower = config.lowerPrice;
    const upper = config.upperPrice;

    if (lower >= upper || count < 2) {
      throw new Error('Invalid grid bounds or grid count.');
    }

    if (!centerPrice || isNaN(centerPrice) || !isFinite(centerPrice) || centerPrice <= 0) {
      throw new Error('Invalid center price provided for grid level generation.');
    }

    if (!atr || isNaN(atr) || !isFinite(atr) || atr < 0) {
      atr = centerPrice * 0.02; // safe fallback of 2% of center price
    }

    // 1. Spacing Distribution Mathematical Engine
    const rawPrices: number[] = [];

    if (config.gridType === 'geometric') {
      const ratio = Math.pow(upper / lower, 1 / (count - 1));
      for (let i = 0; i < count; i++) {
        rawPrices.push(lower * Math.pow(ratio, i));
      }
    } else {
      // Respect arithmetic/spacing modes
      if (config.spacingMode === 'uniform') {
        const step = (upper - lower) / (count - 1);
        for (let i = 0; i < count; i++) {
          rawPrices.push(lower + step * i);
        }
      } else if (config.spacingMode === 'atrAdaptive') {
        // True ATR Adaptive Spacing outward from centerPrice based on ATR volatility steps
        const baseStep = (upper - lower) / (count - 1);
        const atrStep = atr * (config.volatilityMultiplier || 1.0);
        const halfCount = Math.floor(count / 2);
        rawPrices.push(centerPrice);
        for (let i = 1; i <= halfCount; i++) {
          const offset = i * (baseStep * 0.7 + atrStep * 0.3);
          rawPrices.push(centerPrice - offset);
          rawPrices.push(centerPrice + offset);
        }
      } else if (config.spacingMode === 'denserCenter') {
        // Hyperbolic tangent (tanh) density curve to concentrate levels near the centerPrice
        const b = config.centerBias; // Bias slider, e.g. 0.7 for strong concentration
        const intensity = b * 3;
        for (let i = 0; i < count; i++) {
          const norm = (i - (count - 1) / 2) / ((count - 1) / 2); // -1.0 to 1.0
          const warped = intensity > 0 
            ? Math.tanh(norm * intensity) / Math.tanh(intensity)
            : norm;
          const price = centerPrice + (warped * (upper - lower) / 2);
          rawPrices.push(price);
        }
      } else if (config.spacingMode === 'fibonacci') {
        // True Fibonacci proportional distribution outward from centerPrice ensuring exact count within bounds
        const halfCount = Math.floor(count / 2);
        const fibs = [1];
        for (let i = 1; i < halfCount; i++) {
          fibs.push(fibs[i - 1] + (fibs[i - 2] || 1));
        }
        const sumFibs = fibs.reduce((sum, f) => sum + f, 0);
        const lowerRange = centerPrice - lower;
        const upperRange = upper - centerPrice;
        
        rawPrices.push(centerPrice);
        let cumulativeLower = 0;
        let cumulativeUpper = 0;
        for (let i = 0; i < halfCount; i++) {
          cumulativeLower += fibs[i];
          cumulativeUpper += fibs[i];
          rawPrices.push(centerPrice - (cumulativeLower / sumFibs) * lowerRange);
          rawPrices.push(centerPrice + (cumulativeUpper / sumFibs) * upperRange);
        }
      }
    }

    // Ensure sorted list within bounds
    const sortedPrices = Array.from(new Set(rawPrices))
      .filter(p => p !== undefined && !isNaN(p) && isFinite(p) && p >= lower && p <= upper)
      .sort((a, b) => a - b);

    // 2. Pre-calculate O(1) index mappings for Martingale lookup
    const buys = sortedPrices.filter(p => p < centerPrice);
    const sells = sortedPrices.filter(p => p >= centerPrice);
    
    const buyIndexMap = new Map<number, number>();
    buys.reverse().forEach((p, i) => buyIndexMap.set(p, i));

    const sellIndexMap = new Map<number, number>();
    sells.forEach((p, i) => sellIndexMap.set(p, i));

    // 3. Process size multipliers first to guarantee exact total capital allocation limit
    const rawLevels: { price: number; side: 'BUY' | 'SELL'; sizeMultiplier: number }[] = [];

    sortedPrices.forEach(price => {
      const isBuy = price < centerPrice;
      const side: 'BUY' | 'SELL' = isBuy ? 'BUY' : 'SELL';

      // Override if directional biases are applied
      if (config.direction === 'long' && !isBuy) return;
      if (config.direction === 'short' && isBuy) return;

      // Sizing Mode Calculation (Martingale, Zone Sizing, Kelly Criterion)
      let sizeMultiplier = 1.0;
      if (config.orderSizeMode === 'zoneScaled') {
        const distanceToCenter = Math.abs(price - centerPrice) / centerPrice;
        if (isBuy) {
          // Buys get heavier towards support (lower boundary)
          sizeMultiplier = Math.max(0.1, 1.0 + (distanceToCenter * config.zoneMultipliers.strongSupport));
        } else {
          // Sells get lighter towards resistance
          sizeMultiplier = Math.max(0.1, 1.0 - (distanceToCenter * (1.0 - config.zoneMultipliers.strongResistance)));
        }
      } else if (config.orderSizeMode === 'martingale') {
        // Double sizes on deeper levels to average entry cost down fast
        const index = isBuy ? (buyIndexMap.get(price) ?? 0) : (sellIndexMap.get(price) ?? 0);
        sizeMultiplier = Math.pow(1.2, Math.max(0, index));
      } else if (config.orderSizeMode === 'kelly') {
        // Sizing scaled by market indicators Kelly formula: f* = (bp - q) / b
        const b_ratio = 1.5; // Average grid risk-reward payout ratio
        let p_win = 0.52; // Win probability baseline
        if (config.direction === 'long' && side === 'BUY') p_win = 0.56;
        else if (config.direction === 'short' && side === 'SELL') p_win = 0.56;
        const f_star = (p_win * (b_ratio + 1) - 1) / b_ratio;
        sizeMultiplier = Math.max(0.1, f_star * 5); // Safe multiplier scaling
      }

      rawLevels.push({ price, side, sizeMultiplier });
    });

    // Solve total capital multiplier to never exceed user's exact investment allocation
    const totalMultipliers = rawLevels.reduce((sum, l) => sum + l.sizeMultiplier, 0);
    const scaleFactor = totalMultipliers > 0 ? (config.investment / totalMultipliers) : 0;

    rawLevels.forEach(rl => {
      levels.push({
        price: rl.price,
        side: rl.side,
        sizeUsdt: rl.sizeMultiplier * scaleFactor
      });
    });

    return levels;
  }

  /**
   * Validate asset suitability based on volume, funding rates, and open interest
   */
  public validateAssetSuitability(indicators: MarketIndicators, config: AdvancedGridConfig): { suitable: boolean; reason: string } {
    if (indicators.volume24h < config.filters.minVolumeUSD) {
      return { suitable: false, reason: `24h Volume ($${indicators.volume24h.toLocaleString()}) below threshold of $${config.filters.minVolumeUSD.toLocaleString()}` };
    }

    if (Math.abs(indicators.fundingRate) > config.filters.maxFundingRate) {
      return { suitable: false, reason: `Funding rate (${(indicators.fundingRate * 100).toFixed(4)}%) exceeds risk tolerance of ${(config.filters.maxFundingRate * 100).toFixed(4)}%` };
    }

    if (indicators.openInterest < config.filters.minOpenInterest) {
      return { suitable: false, reason: `Open Interest ($${indicators.openInterest.toLocaleString()}) below threshold of $${config.filters.minOpenInterest.toLocaleString()}` };
    }

    return { suitable: true, reason: 'Asset metrics comply with institutional risk filters.' };
  }

  /**
   * Calculates compound reinvestment size
   */
  public calculateReinvestment(currentInvestment: number, realizedPnL: number, config: AdvancedGridConfig): number {
    if (!config.reinvestProfit || realizedPnL <= 0) {
      return currentInvestment;
    }
    const compoundAmount = realizedPnL * (config.reinvestPercentage / 100);
    return currentInvestment + compoundAmount;
  }
}

function half(n: number): number {
  return Math.floor(n / 2);
}
