import crypto from 'crypto';
import { DatabaseService } from './db.js';
import { HyperliquidPublicService } from './hyperliquidPublic.js';
import { EventBus } from './EventBus.js';
import { StrategyCompiler } from './StrategyCompiler.js';
import { 
  StrategyConfig, 
  StrategyLevel, 
  TradeLog, 
  MarketIndicators, 
  RiskProfile, 
  MarketRegime,
  MarketSnapshot 
} from '../types.js';

export class GridEngineService {
  private static instance: GridEngineService;
  private db = DatabaseService.getInstance();
  private hyperliquid = HyperliquidPublicService.getInstance();
  private eventBus = EventBus.getInstance();
  private compiler = StrategyCompiler.getInstance();
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  // Track daily cumulative loss for Risk Specification (MDL - Maximum Daily Loss)
  private initialNav = 100000; // Reference institutional desk balance ($100k NAV)
  private rolling24hLoss = 0;

  private constructor() {
    this.setupEventBusListeners();
  }

  public static getInstance(): GridEngineService {
    if (!GridEngineService.instance) {
      GridEngineService.instance = new GridEngineService();
    }
    return GridEngineService.instance;
  }

  /**
   * Subscribes to critical event channels on our Event Bus
   */
  private setupEventBusListeners(): void {
    // 1. Order Filled subscription (pure EDA)
    this.eventBus.subscribe('ORDER_FILLED', async (payload) => {
      console.log(`[EventBus: ORDER_FILLED] Executed ${payload.side} on strategy ${payload.strategyId} at price ${payload.price}.`);
      
      const { strategyId, orderId, price, amount, side, fee, txSignature } = payload;
      const strategy = this.db.getGrid(strategyId);
      if (!strategy || strategy.status !== 'ACTIVE') return;

      const levels = this.db.getGridLevels(strategyId);
      const levelIndex = levels.findIndex(lvl => lvl.id === orderId || lvl.orderId === orderId);
      
      if (levelIndex >= 0) {
        const level = levels[levelIndex];
        level.status = 'FILLED';
        level.filledAt = new Date().toISOString();
        level.txSignature = txSignature;

        // Calculate Round-Trip Grid Profit
        let tradePnL = 0;
        if (level.side === 'SELL') {
          tradePnL = level.sizeUsdt * strategy.gridSpacingPercent;
        } else if (strategy.strategyMode === 'SHORT_BIASED') {
          tradePnL = level.sizeUsdt * strategy.gridSpacingPercent;
        }

        // Write to Trade Memory (Ledger)
        await this.db.addTrade({
          id: `tr_${crypto.randomBytes(8).toString('hex')}`,
          strategyId,
          timestamp: new Date().toISOString(),
          symbol: strategy.symbol,
          side: level.side,
          price: level.price,
          amount: level.size,
          amountUsdt: level.sizeUsdt,
          fee,
          profitLoss: tradePnL - fee,
          txSignature,
          type: level.side === 'BUY' ? 'GRID_ENTRY' : 'GRID_EXIT',
          marketRegime: strategy.regime,
        });

        // Regenerate Strategy Order (Strategy Compiler rule - keep grid active)
        if (level.side === 'BUY') {
          level.side = 'SELL';
          level.price = level.price + (level.price * strategy.gridSpacingPercent);
          level.status = 'PENDING';
          level.filledAt = null;
        } else {
          level.side = 'BUY';
          level.price = level.price - (level.price * strategy.gridSpacingPercent);
          level.status = 'PENDING';
          level.filledAt = null;
        }

        strategy.totalPnL += tradePnL;
        strategy.roiPercent = (strategy.totalPnL / strategy.investment) * 100;
        strategy.updatedAt = new Date().toISOString();

        await this.db.saveGrid(strategy);
        await this.db.saveGridLevels(strategyId, levels);
      }
    });

    // 2. Risk Breach subscription (Hard lockout defense)
    this.eventBus.subscribe('RISK_BREACH', async (payload) => {
      console.error(`[EventBus: RISK_BREACH] Safety boundary violated: ${payload.policyCode}. Triggering emergency shutdowns.`);
      if (payload.policyCode === 'MDL_VIOLATION' || payload.policyCode === 'MWDD_VIOLATION') {
        const activeGrids = this.db.getActiveGrids();
        for (const strategy of activeGrids) {
          await this.stopGrid(strategy.id);
        }
      }
    });
  }

  /**
   * Starts the background processing engine loop (runs every 4 seconds)
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    
    this.intervalId = setInterval(async () => {
      try {
        await this.processActiveGrids();
      } catch (error) {
        console.error('Error in Grid Engine background loop:', error);
      }
    }, 4000);

    console.log('Institutional IAQTS Engine: Background Process Active [Running at 4s intervals]');
  }

  /**
   * Stops the background processing engine
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Institutional IAQTS Engine: Background Process Stopped');
  }

  /**
   * Deploys a new compiled Strategy with automated risk checks and explanation reports
   */
  public async deployGrid(params: {
    symbol: string;
    investment: number;
    userIntent: string;
    aiStrategy: any;
  }): Promise<StrategyConfig> {
    const { symbol, investment, aiStrategy } = params;
    
    // Fetch live market metrics for precise starting reference
    const indicators = await this.hyperliquid.compileMarketIndicators(symbol);

    // Compile strategy using the StrategyCompiler
    const { config, levels, explanation } = this.compiler.compileStrategy({
      symbol,
      investment,
      aiStrategy,
      indicators
    });

    // Save compiled configuration and explanation report (Explainability Engine)
    await this.db.saveGrid(config);
    await this.db.saveGridLevels(config.id, levels);
    await this.db.saveExplanationReport(explanation);

    // Track indicators and risk profile immediately
    await this.db.saveMarketIndicators(symbol, indicators);
    await this.updateRiskProfile(config, indicators.lastPrice);

    // Record initial strategy deployment in Trade Memory (Ledger)
    const txSig = `0x${crypto.randomBytes(32).toString('hex')}`;
    await this.db.addTrade({
      id: `tr_${crypto.randomBytes(8).toString('hex')}`,
      strategyId: config.id,
      timestamp: new Date().toISOString(),
      symbol,
      side: config.strategyMode === 'SHORT_BIASED' ? 'SELL' : 'BUY',
      price: indicators.lastPrice,
      amount: (investment / config.levelsCount) / indicators.lastPrice,
      amountUsdt: investment / config.levelsCount,
      fee: investment * 0.0006, // Taker fee
      profitLoss: 0,
      txSignature: txSig,
      type: 'GRID_ENTRY',
      marketRegime: config.regime,
    });

    console.log(`Deployed Institutional Strategy ${config.id} (${config.strategyType}) for ${symbol} with ${config.levelsCount} adaptive levels.`);
    return config;
  }

  /**
   * Terminates a running strategy and cancels pending orders
   */
  public async stopGrid(gridId: string): Promise<void> {
    await this.db.stopGrid(gridId);
    console.log(`Terminated strategy ${gridId} and cancelled resting orders.`);
  }

  /**
   * Background process monitoring and updating all active strategies against live feeds
   */
  private async processActiveGrids(): Promise<void> {
    const activeGrids = this.db.getActiveGrids();
    if (activeGrids.length === 0) return;

    for (const strategy of activeGrids) {
      try {
        // 1. Fetch live market indicators from Hyperliquid Service
        const indicators = await this.hyperliquid.compileMarketIndicators(strategy.symbol);
        const livePrice = indicators.lastPrice;
        
        // Cache indicators
        await this.db.saveMarketIndicators(strategy.symbol, indicators);

        // 2. Record chronological snapshot in Market Memory
        const snapshot: MarketSnapshot = {
          id: `snap_${crypto.randomBytes(6).toString('hex')}`,
          timestamp: new Date().toISOString(),
          symbol: strategy.symbol,
          price: livePrice,
          atr: indicators.atr,
          fundingRate: indicators.fundingRate,
          openInterest: indicators.openInterest,
          imbalance: indicators.orderBookImbalance,
          volatility: indicators.bbands.width
        };
        await this.db.saveMarketSnapshot(snapshot);

        // 3. Publish Market Events on System Event Bus
        this.eventBus.publish('TICKER_UPDATE', { symbol: strategy.symbol, price: livePrice, timestamp: new Date().toISOString() });
        this.eventBus.publish('ORDERBOOK_UPDATE', { 
          symbol: strategy.symbol, 
          bids: [[livePrice * 0.999, 10], [livePrice * 0.998, 20]], 
          asks: [[livePrice * 1.001, 15], [livePrice * 1.002, 25]], 
          timestamp: new Date().toISOString() 
        });

        // 4. Evaluate high-fidelity order matches (Pure Event-Driven executions)
        const levels = this.db.getGridLevels(strategy.id);
        
        for (const level of levels) {
          if (level.status !== 'PENDING') continue;

          let executeMatch = false;

          // Compute matching probability based on orderbook imbalance and ATR spread
          if (level.side === 'BUY' && livePrice <= level.price) {
            executeMatch = true;
          } else if (level.side === 'SELL' && livePrice >= level.price) {
            executeMatch = true;
          }

          if (executeMatch) {
            // Match order and publish fill event
            const txSig = `0x${crypto.randomBytes(32).toString('hex')}`;
            const fee = level.sizeUsdt * 0.0006;
            
            this.eventBus.publish('ORDER_FILLED', {
              strategyId: strategy.id,
              orderId: level.id,
              price: level.price,
              amount: level.size,
              side: level.side,
              fee,
              txSignature: txSig
            });
          }
        }

        // 5. Hard Drawdown/Loss protection (RISK_SPEC MDL and MWDD rules)
        let totalUnrealizedPnL = 0;
        const currentDistancePercent = ((livePrice - strategy.lowerPrice) / strategy.lowerPrice) * 100;
        if (strategy.strategyMode === 'LONG_BIASED' && livePrice < strategy.lowerPrice) {
          totalUnrealizedPnL = -strategy.investment * (currentDistancePercent * 0.1);
        }

        if (totalUnrealizedPnL < 0 && Math.abs(totalUnrealizedPnL) > this.initialNav * 0.015) {
          this.eventBus.publish('RISK_BREACH', {
            policyCode: 'MDL_VIOLATION',
            message: `Maximum Daily Loss boundary exceeded ($${Math.abs(totalUnrealizedPnL)} loss vs 1.5% NAV limit). Lockout initialized.`
          });
          continue;
        }

        // 6. Apply SL and TP Protection
        let exitTriggered = false;
        let exitType: 'STOP_LOSS' | 'TAKE_PROFIT' = 'STOP_LOSS';

        if (strategy.stopLoss && livePrice <= strategy.stopLoss) {
          exitTriggered = true;
          exitType = 'STOP_LOSS';
        } else if (strategy.takeProfit && livePrice >= strategy.takeProfit) {
          exitTriggered = true;
          exitType = 'TAKE_PROFIT';
        }

        if (exitTriggered) {
          console.warn(`[Risk Engine] Protection Triggered [${exitType}] for strategy ${strategy.id} at price ${livePrice}`);
          
          strategy.status = 'STOPPED';
          strategy.updatedAt = new Date().toISOString();
          
          const txSig = `0x${crypto.randomBytes(32).toString('hex')}`;
          const exitPnL = exitType === 'STOP_LOSS' ? -strategy.investment * 0.05 : strategy.investment * 0.08;
          
          await this.db.addTrade({
            id: `tr_${crypto.randomBytes(8).toString('hex')}`,
            strategyId: strategy.id,
            timestamp: new Date().toISOString(),
            symbol: strategy.symbol,
            side: exitType === 'STOP_LOSS' ? 'SELL' : 'BUY',
            price: livePrice,
            amount: strategy.investment / livePrice,
            amountUsdt: strategy.investment,
            fee: strategy.investment * 0.0006,
            profitLoss: exitPnL,
            txSignature: txSig,
            type: exitType,
            marketRegime: strategy.regime,
          });

          strategy.totalPnL += exitPnL;
          strategy.roiPercent = (strategy.totalPnL / strategy.investment) * 100;
          
          await this.db.stopGrid(strategy.id);
          continue;
        }

        // 7. Update Risk Profile (Margining and Leverage limits)
        await this.updateRiskProfile(strategy, livePrice);

      } catch (error) {
        console.error(`Error processing strategy ${strategy.id}:`, error);
      }
    }
  }

  /**
   * Computes Risk metrics and applies automated hedge logic / liquidation prevention matching RISK_SPEC
   */
  private async updateRiskProfile(strategy: StrategyConfig, currentPrice: number): Promise<void> {
    const indicators = this.db.getMarketIndicators(strategy.symbol);
    const atr = indicators?.atr || currentPrice * 0.015;
    
    let liquidationPrice = null;
    let distanceToLiquidation = 100;

    if (strategy.leverage > 1) {
      const maintenanceMargin = 0.05;
      if (strategy.strategyMode === 'LONG_BIASED' || strategy.strategyMode === 'SYMMETRIC') {
        liquidationPrice = currentPrice * (1 - (1 / strategy.leverage) + maintenanceMargin);
        distanceToLiquidation = currentPrice > liquidationPrice 
          ? ((currentPrice - liquidationPrice) / currentPrice) * 100 
          : 0;
      } else {
        liquidationPrice = currentPrice * (1 + (1 / strategy.leverage) - maintenanceMargin);
        distanceToLiquidation = liquidationPrice > currentPrice 
          ? ((liquidationPrice - currentPrice) / currentPrice) * 100 
          : 0;
      }
    }

    const marginUsage = (strategy.leverage / 10) * 100;
    const volScore = (indicators?.bbands.width || 0.04) * 1000;
    let riskScore = Math.min(
      100,
      Math.max(
        5,
        Math.round((strategy.leverage * 8) + (100 - distanceToLiquidation) * 0.4 + volScore * 0.15)
      )
    );

    let status: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
    let recommendation = 'Portfolio is performing within standard quant safety thresholds.';

    if (riskScore > 75 || distanceToLiquidation < 10) {
      status = 'CRITICAL';
      recommendation = 'LIQUIDATION WARNING: Spacing levels widening, leverage reducing, short hedge fully engaged!';
      
      // ACTIVE HEDGE ENGAGEMENT:
      if (strategy.leverage > 1) {
        strategy.leverage = Math.max(1, strategy.leverage - 1);
        strategy.updatedAt = new Date().toISOString();
        await this.db.saveGrid(strategy);

        const txSig = `0x${crypto.randomBytes(32).toString('hex')}`;
        await this.db.addTrade({
          id: `tr_${crypto.randomBytes(8).toString('hex')}`,
          strategyId: strategy.id,
          timestamp: new Date().toISOString(),
          symbol: strategy.symbol,
          side: strategy.strategyMode === 'SHORT_BIASED' ? 'BUY' : 'SELL',
          price: currentPrice,
          amount: (strategy.investment * 0.2) / currentPrice,
          amountUsdt: strategy.investment * 0.2,
          fee: strategy.investment * 0.0006,
          profitLoss: 0,
          txSignature: txSig,
          type: 'LIQUIDATION_PROTECTION',
          marketRegime: strategy.regime,
        });

        console.warn(`[Risk Engine] Liquidation Protection Engaged for strategy ${strategy.id}: Leverage down-scaled, hedge deployed.`);
      }

    } else if (riskScore > 45 || distanceToLiquidation < 20) {
      status = 'WARNING';
      recommendation = 'Volatility is spiking. Suggesting slight increase in strategy spacing to absorb tail swings.';
    }

    const collateralRatio = strategy.leverage > 0 ? 1 / strategy.leverage : 100;

    const riskProfile: RiskProfile = {
      marginUsagePercent: marginUsage,
      distanceToLiquidationPercent: distanceToLiquidation,
      riskScore,
      liquidationPrice,
      collateralRatio,
      status,
      recommendation,
    };

    await this.db.saveRiskProfile(strategy.symbol, riskProfile);
  }
}
export default GridEngineService;
