import { EventEmitter } from 'events';
import { signHyperliquidAction } from '../../src/services/signer.js';
import { GridEngineAdvanced, AdvancedGridConfig } from '../../src/services/GridEngineAdvanced.js';

const HYPERLIQUID_MAINNET_API = 'https://api.hyperliquid.xyz';
const HYPERLIQUID_TESTNET_API = 'https://api.hyperliquid-testnet.xyz';

export interface GridOrder {
  id: string;
  price: number;
  side: 'BUY' | 'SELL';
  sz: number;
  filledSz?: number; // Tracks partial fill size
  status: 'PENDING' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED';
  mode: 'live' | 'paper';
  purchasePrice?: number;
}

/**
 * Shared Rate Limiter to protect from burst limits
 */
class RateLimiter {
  private static lastRequestTime = 0;
  private static minInterval = 50; // min 50ms between any requests to avoid bursts
  
  public static async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}

/**
 * Shared Market Data Service with rate-limiting and caching to avoid hitting API limits
 */
class MarketDataCache {
  private static prices = new Map<string, { price: number; timestamp: number }>();
  
  public static async getMidPrice(symbol: string, useTestnet: boolean): Promise<number> {
    const cacheKey = `${symbol}_${useTestnet}`;
    const cached = this.prices.get(cacheKey);
    const now = Date.now();
    
    // Cache for 2.5 seconds to avoid spamming the exchange info endpoints
    if (cached && now - cached.timestamp < 2500) {
      return cached.price;
    }
    
    await RateLimiter.throttle();
    const infoUrl = useTestnet ? `${HYPERLIQUID_TESTNET_API}/info` : `${HYPERLIQUID_MAINNET_API}/info`;
    const response = await fetch(infoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' }),
    });

    if (!response.ok) {
      if (cached) return cached.price;
      throw new Error(`Failed to fetch mids. Status: ${response.status}`);
    }

    const mids = await response.json();
    const priceStr = mids[symbol.toUpperCase()];
    if (!priceStr) {
      if (cached) return cached.price;
      throw new Error(`No mid price found for symbol: ${symbol}`);
    }

    const price = parseFloat(priceStr);
    this.prices.set(cacheKey, { price, timestamp: now });
    return price;
  }
}

export class HyperliquidGridEngine extends EventEmitter {
  private walletAddress: string;
  private privateKey: string;
  private config: AdvancedGridConfig;
  private isRunning = false;
  private isProcessing = false;
  private intervalId: NodeJS.Timeout | null = null;
  private currentNonce = Date.now();
  
  // Dynamic market properties
  private centerPrice: number = 0;
  private assetIndex: number = -1;
  private szDecimals: number = 4;
  
  // O(1) Memory Map structures & Memory Leak Cap
  private gridLevels: { price: number; side: 'BUY' | 'SELL'; sizeUsdt: number }[] = [];
  private activeOrders = new Map<string, GridOrder>();
  private completedOrders: GridOrder[] = []; // Capped historical orders archive
  private totalRealizedPnL = 0;

  constructor(walletAddress: string, privateKey: string, config: AdvancedGridConfig) {
    super();
    this.walletAddress = walletAddress;
    this.privateKey = privateKey;
    this.config = config;
  }

  /**
   * Generates a unique, strictly monotonic L1 transaction nonce
   */
  private getNextNonce(): number {
    const now = Date.now();
    if (now > this.currentNonce) {
      this.currentNonce = now;
    } else {
      this.currentNonce++;
    }
    return this.currentNonce;
  }

  /**
   * Safe fetch with robust retry mechanisms & automatic rate-limiting throttles
   */
  private async fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        await RateLimiter.throttle();
        const response = await fetch(url, options);
        if (response.ok) return response;
        if (response.status >= 500) {
          await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
          continue;
        }
        return response; // Return client error immediately
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
      }
    }
    throw new Error(`Failed to fetch from ${url} after ${retries} retries.`);
  }

  /**
   * Starts the grid trading engine
   */
  public async start() {
    if (this.isRunning) return;
    
    if (!this.walletAddress || !this.privateKey) {
      const err = new Error('Wallet Address and Private Key are strictly required for signing Hyperliquid orders.');
      this.emit('error', err);
      throw err;
    }

    console.log(`[HyperliquidGridEngine] Initializing Adaptive Grid for ${this.config.symbol} with $${this.config.investment} USDT`);

    try {
      // 1. Map coin to asset index dynamically from Universe metadata
      await this.fetchAssetMetadata();

      // 2. Fetch current ticker center price
      await this.fetchCurrentPriceAndIndicators();

      // 3. Generate non-uniform grid level distribution using GridEngineAdvanced math
      const advancedMath = GridEngineAdvanced.getInstance();
      this.gridLevels = advancedMath.generateGridLevels(this.config, this.centerPrice, this.centerPrice * 0.02);

      this.isRunning = true;
      this.emit('started', { centerPrice: this.centerPrice, levelsCount: this.gridLevels.length });

      // 4. Deploy initial set of orders to the exchange
      await this.deployGridOrders();

      // 5. Start lightweight high-frequency price updater / execution observer
      this.intervalId = setInterval(() => this.monitorPriceAndFills(), 1500);
    } catch (err: any) {
      console.error('[HyperliquidGridEngine] Start failure:', err.message);
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Formats prices mathematically to guarantee at most 5 significant figures
   * as strictly required by Hyperliquid L1 orderbook.
   */
  private formatPrice(price: number): string {
    if (price <= 0) return '0';
    const exponent = Math.floor(Math.log10(price));
    // Tick size is 10^(exponent - 4) to ensure exactly 5 significant figures
    const tickSize = Math.pow(10, exponent - 4);
    const rounded = Math.round(price / tickSize) * tickSize;
    return Number(rounded.toPrecision(5)).toString();
  }

  /**
   * Fetches Hyperliquid asset index and size decimals dynamically
   */
  private async fetchAssetMetadata() {
    const isTestnet = process.env.HYPERLIQUID_USE_TESTNET === 'true';
    const infoUrl = isTestnet ? HYPERLIQUID_TESTNET_API : HYPERLIQUID_MAINNET_API;
    
    try {
      const response = await this.fetchWithRetry(`${infoUrl}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta' }),
      });

      const meta = await response.json();
      const universe = meta.universe || [];
      
      const symbolUpper = this.config.symbol.toUpperCase();
      const index = universe.findIndex((asset: any) => asset.name === symbolUpper);

      if (index === -1) {
        throw new Error(`Symbol ${this.config.symbol} not found in Hyperliquid asset universe.`);
      }

      this.assetIndex = index;
      const assetDetails = universe[index];
      this.szDecimals = assetDetails.szDecimals || 4;

      console.log(`[HyperliquidGridEngine] Dynamic asset resolved: ${symbolUpper} -> Index ${this.assetIndex} (szDec: ${this.szDecimals})`);
    } catch (error: any) {
      console.error('[HyperliquidGridEngine] Error fetching metadata, using fallback defaults:', error.message);
      this.emit('error', error);
      // Fallback indices
      if (this.config.symbol.toUpperCase() === 'BTC') {
        this.assetIndex = 0;
        this.szDecimals = 4;
      } else if (this.config.symbol.toUpperCase() === 'ETH') {
        this.assetIndex = 1;
        this.szDecimals = 3;
      } else {
        this.assetIndex = 0; // Default fallback index
      }
    }
  }

  /**
   * Fetches current market mid-price for the symbol
   */
  private async fetchCurrentPriceAndIndicators() {
    const isTestnet = process.env.HYPERLIQUID_USE_TESTNET === 'true';
    this.centerPrice = await MarketDataCache.getMidPrice(this.config.symbol, isTestnet);
  }

  /**
   * Helper to place a single grid level order (Live on L1 or fallback to paper)
   */
  private async placeSingleGridLevel(price: number, side: 'BUY' | 'SELL', sizeUsdt: number, forceMode?: 'live' | 'paper', purchasePrice?: number) {
    const amountSz = sizeUsdt / price;
    const formattedPrice = this.formatPrice(price);
    const formattedSize = amountSz.toFixed(this.szDecimals);

    const isBuy = side === 'BUY';
    const isTestnet = process.env.HYPERLIQUID_USE_TESTNET === 'true';
    const exchangeUrl = isTestnet ? `${HYPERLIQUID_TESTNET_API}/exchange` : `${HYPERLIQUID_MAINNET_API}/exchange`;

    // 1. Determine execution mode
    let mode: 'live' | 'paper' = forceMode || (isTestnet ? 'live' : 'paper');

    if (mode === 'live') {
      const orderAction = {
        type: 'order',
        orders: [
          {
            asset: this.assetIndex,
            isBuy: isBuy,
            limitPx: formattedPrice,
            sz: formattedSize,
            reduceOnly: false,
            orderType: { limit: { tif: 'Gtc' } },
            cloid: null
          }
        ],
        grouping: 'na'
      };

      const nonce = this.getNextNonce();

      try {
        const { r, s, v } = await signHyperliquidAction(this.privateKey, orderAction, nonce, null);
        
        const payload = {
          action: orderAction,
          nonce,
          signature: { r, s, v },
          vaultAddress: null
        };

        const res = await this.fetchWithRetry(exchangeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        const statusObj = data.response?.data?.statuses?.[0];

        if (data.status === 'ok' && statusObj && (statusObj.resting || statusObj.filled)) {
          const exchangeOid = (statusObj.resting?.oid || statusObj.filled?.oid).toString();
          this.activeOrders.set(exchangeOid, {
            id: exchangeOid,
            price: Number(formattedPrice),
            side,
            sz: parseFloat(formattedSize),
            filledSz: statusObj.filled ? parseFloat(formattedSize) : 0,
            status: statusObj.filled ? 'FILLED' : 'PENDING',
            mode: 'live',
            purchasePrice
          });
          return;
        } else {
          const errMsg = statusObj?.error || 'Unknown exchange reject';
          console.warn(`[HyperliquidGridEngine] Exchange rejected order (${errMsg}), fallback to paper-trading.`);
          this.emit('error', new Error(`Exchange order rejected: ${errMsg}. Fallback to paper.`));
          mode = 'paper';
        }
      } catch (err: any) {
        console.error('[HyperliquidGridEngine] Signing failed, falling back to paper-trading:', err.message);
        this.emit('error', err);
        mode = 'paper';
      }
    }

    if (mode === 'paper') {
      const simId = `sim_${Math.random().toString(36).slice(2, 11)}`;
      this.activeOrders.set(simId, {
        id: simId,
        price: Number(formattedPrice),
        side,
        sz: parseFloat(formattedSize),
        filledSz: 0,
        status: 'PENDING',
        mode: 'paper',
        purchasePrice
      });
    }
  }

  /**
   * Signs and places limit orders for all levels generated
   */
  private async deployGridOrders() {
    console.log(`[HyperliquidGridEngine] Placing initial ${this.gridLevels.length} grid orders...`);
    for (const lvl of this.gridLevels) {
      if (!this.isRunning) return;
      await this.placeSingleGridLevel(lvl.price, lvl.side, lvl.sizeUsdt);
    }
    this.emit('grid-ready', { activeOrdersCount: this.activeOrders.size });
  }

  /**
   * Cancels all resting grid orders on the exchange
   */
  private async cancelAllOrders() {
    if (this.activeOrders.size === 0) return;

    const isTestnet = process.env.HYPERLIQUID_USE_TESTNET === 'true';
    const exchangeUrl = isTestnet ? `${HYPERLIQUID_TESTNET_API}/exchange` : `${HYPERLIQUID_MAINNET_API}/exchange`;
    
    const pendingExchangeOrders = Array.from(this.activeOrders.values())
      .filter(o => o.mode === 'live' && (o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED'));

    if (pendingExchangeOrders.length === 0) {
      this.activeOrders.clear();
      return;
    }

    const cancels = pendingExchangeOrders.map(o => ({
      asset: this.assetIndex,
      oid: parseInt(o.id)
    }));

    const cancelAction = {
      type: 'cancel',
      cancels,
    };

    const nonce = this.getNextNonce();

    try {
      const { r, s, v } = await signHyperliquidAction(this.privateKey, cancelAction, nonce, null);
      const payload = {
        action: cancelAction,
        nonce,
        signature: { r, s, v },
        vaultAddress: null
      };

      await this.fetchWithRetry(exchangeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      console.error('[HyperliquidGridEngine] Error cancelling orders:', err.message);
      this.emit('error', err);
    }

    this.activeOrders.clear();
  }

  /**
   * Periodically checks live market price to match filled levels and perform auto-reinvest
   */
  private async monitorPriceAndFills() {
    if (this.isProcessing || !this.isRunning) return;
    this.isProcessing = true;

    try {
      const isTestnet = process.env.HYPERLIQUID_USE_TESTNET === 'true';
      this.centerPrice = await MarketDataCache.getMidPrice(this.config.symbol, isTestnet);
      
      if (!this.isRunning) return;

      // 1. Fetch current open orders from exchange if we have live pending orders
      const openExchangeOrderIds = new Set<string>();
      const hasLivePending = Array.from(this.activeOrders.values()).some(o => o.mode === 'live' && (o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED'));
      
      if (hasLivePending) {
        try {
          const infoUrl = isTestnet ? `${HYPERLIQUID_TESTNET_API}/info` : `${HYPERLIQUID_MAINNET_API}/info`;
          const response = await this.fetchWithRetry(infoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'openOrders', user: this.walletAddress }),
          });
          const openOrdersList = await response.json();
          if (Array.isArray(openOrdersList)) {
            openOrdersList.forEach((order: any) => {
              if (order.oid) openExchangeOrderIds.add(order.oid.toString());
            });
          }
        } catch (e: any) {
          console.error('[HyperliquidGridEngine] Error fetching open orders for live check:', e.message);
        }
      }

      if (!this.isRunning) return;

      // 2. Fetch user fill history to determine exact execution sizes and prevent treating manual cancellations as fully filled
      const orderFillsMap = new Map<string, number>();
      if (hasLivePending) {
        try {
          const infoUrl = isTestnet ? `${HYPERLIQUID_TESTNET_API}/info` : `${HYPERLIQUID_MAINNET_API}/info`;
          const response = await this.fetchWithRetry(infoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'userFills', user: this.walletAddress }),
          });
          const fillsList = await response.json();
          if (Array.isArray(fillsList)) {
            fillsList.forEach((fill: any) => {
              if (fill.oid && fill.coin === this.config.symbol.toUpperCase()) {
                const oidStr = fill.oid.toString();
                const szVal = parseFloat(fill.sz || '0');
                orderFillsMap.set(oidStr, (orderFillsMap.get(oidStr) || 0) + szVal);
              }
            });
          }
        } catch (e: any) {
          console.error('[HyperliquidGridEngine] Error fetching user fills history:', e.message);
        }
      }

      if (!this.isRunning) return;

      let changed = false;

      // 3. Monitor grid fills and update status transitions
      for (const order of Array.from(this.activeOrders.values())) {
        if (!this.isRunning) return;
        if (order.status !== 'PENDING' && order.status !== 'PARTIALLY_FILLED') continue;

        let isFilled = false;
        let isPartiallyFilled = false;
        let finalSize = order.sz;

        if (order.mode === 'live') {
          const filledAmount = orderFillsMap.get(order.id) || 0;
          order.filledSz = filledAmount;

          if (filledAmount >= order.sz) {
            isFilled = true;
          } else if (filledAmount > 0) {
            isPartiallyFilled = true;
          }

          // If the order is no longer open in the order book, evaluate if it filled or was cancelled
          if (!openExchangeOrderIds.has(order.id)) {
            if (filledAmount > 0) {
              // Was partially filled, but now cancelled/off-book, so we treat the filled part as completed
              isFilled = true;
              finalSize = filledAmount;
            } else {
              // Cancelled cleanly without any fills
              order.status = 'CANCELLED';
              changed = true;
              
              // Evict from activeOrders and archive into capped historical array
              this.activeOrders.delete(order.id);
              this.completedOrders.push(order);
              if (this.completedOrders.length > 200) {
                this.completedOrders.shift();
              }
            }
          }
        } else {
          // Paper trading evaluation
          const isHit = order.side === 'BUY' 
            ? this.centerPrice <= order.price 
            : this.centerPrice >= order.price;
          if (isHit) {
            isFilled = true;
          }
        }

        if (isFilled) {
          order.status = 'FILLED';
          order.filledSz = finalSize;
          changed = true;

          // Calculate trade profit using exact paired reference price, considering actual final filled size
          let profit = 0;
          if (order.purchasePrice !== undefined) {
            if (order.side === 'SELL') {
              profit = (order.price - order.purchasePrice) * finalSize;
            } else {
              profit = (order.purchasePrice - order.price) * finalSize;
            }
          }

          // Incorporate 0.01% Maker execution fee on both sides (entry and exit)
          const feeRate = 0.0001;
          const totalFee = order.price * finalSize * feeRate * 2;
          profit = profit - totalFee;

          if (profit > 0) {
            this.totalRealizedPnL += profit;
            
            // Reinvestment Compound logic
            if (this.config.reinvestProfit) {
              const reinvestAmount = profit * (this.config.reinvestPercentage / 100);
              this.config.investment += reinvestAmount;
              console.log(`[Reinvestment] PnL Compound: Auto-allocated $${reinvestAmount.toFixed(4)} to Active Capital`);
            }
          }

          // Move to capped historical list to avoid memory leaks
          this.activeOrders.delete(order.id);
          this.completedOrders.push(order);
          if (this.completedOrders.length > 200) {
            this.completedOrders.shift();
          }

          // Trigger dynamic event
          this.emit('trade-filled', {
            orderId: order.id,
            price: order.price,
            side: order.side,
            sz: finalSize,
            profit,
            mode: order.mode
          });

          // Re-place the opposite level immediately to keep grid continuity (OKX Infinite Loop Rule)
          const nextSide = order.side === 'BUY' ? 'SELL' : 'BUY';
          const gridDiff = (this.config.upperPrice - this.config.lowerPrice) / (this.config.gridCount - 1 || 1);
          const nextPrice = order.side === 'BUY' 
            ? order.price + gridDiff 
            : order.price - gridDiff;

          if (nextPrice >= this.config.lowerPrice && nextPrice <= this.config.upperPrice) {
            const nextSizeUsdt = (this.config.investment / this.config.gridCount);
            
            // Place the next matched level order asynchronously
            this.placeSingleGridLevel(nextPrice, nextSide, nextSizeUsdt, order.mode, order.price).catch(err => {
              console.error('[HyperliquidGridEngine] Error placing regenerated grid order:', err.message);
              this.emit('error', err);
            });

            this.emit('order-regenerated', { originalId: order.id, nextSide, nextPrice });
          }
        } else if (isPartiallyFilled && order.status !== 'PARTIALLY_FILLED') {
          order.status = 'PARTIALLY_FILLED';
          changed = true;
          
          this.emit('trade-filled', {
            orderId: order.id,
            price: order.price,
            side: order.side,
            sz: order.filledSz,
            profit: 0,
            mode: order.mode,
            isPartial: true
          });
        }
      }

      // Auto-recenter trigger check
      if (this.config.autoRecenter && this.gridLevels.length > 0) {
        const midpoint = this.gridLevels.at(Math.floor(this.gridLevels.length / 2));
        if (midpoint) {
          const devPct = Math.abs(this.centerPrice - midpoint.price) / midpoint.price * 100;
          if (devPct > this.config.recenterTriggerPercent) {
            console.log(`[Auto-Recenter] Market deviation is ${devPct.toFixed(2)}%, triggering dynamic recentering...`);
            await this.recenterGrid(this.centerPrice);
          }
        }
      }

      if (changed) {
        this.emit('grid-updated', this.getEngineState());
      }
    } catch (err: any) {
      console.error('[HyperliquidGridEngine] Monitor loop failure:', err.message);
      this.emit('error', err);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Recenters the grid layout to a new price midpoint
   */
  public async recenterGrid(newCenter: number) {
    console.log(`[HyperliquidGridEngine] Recentering Grid levels around $${newCenter}`);
    await this.cancelAllOrders();
    this.centerPrice = newCenter;
    
    const advancedMath = GridEngineAdvanced.getInstance();
    this.gridLevels = advancedMath.generateGridLevels(this.config, this.centerPrice, this.centerPrice * 0.02);
    
    await this.deployGridOrders();
    this.emit('recentered', { centerPrice: newCenter });
  }

  /**
   * Stop the grid trading engine and cancel all resting orders
   */
  public async stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    await this.cancelAllOrders();
    this.emit('stopped');
  }

  /**
   * Retrieves active engine configuration and states
   */
  public getEngineState() {
    return {
      running: this.isRunning,
      symbol: this.config.symbol,
      investment: this.config.investment,
      centerPrice: this.centerPrice,
      totalRealizedPnL: this.totalRealizedPnL,
      activeOrdersCount: Array.from(this.activeOrders.values()).filter(o => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED').length,
      filledOrdersCount: [...Array.from(this.activeOrders.values()), ...this.completedOrders].filter(o => o.status === 'FILLED').length,
      orders: [...Array.from(this.activeOrders.values()), ...this.completedOrders],
      gridLevels: this.gridLevels,
    };
  }
}
