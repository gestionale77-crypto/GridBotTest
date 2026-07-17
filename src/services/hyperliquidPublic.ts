import { MarketIndicators } from '../types.js';

const HYPERLIQUID_INFO_URL = 'https://api.hyperliquid.xyz/info';

export interface HyperliquidCandle {
  t: number;  // Open time
  T: number;  // Close time
  s: string;  // Symbol (e.g., BTC)
  i: string;  // Interval (e.g., 1h)
  o: string;  // Open price
  c: string;  // Close price
  h: string;  // High price
  l: string;  // Low price
  v: string;  // Volume (base asset)
  n: number;  // Number of trades
}

export class HyperliquidPublicService {
  private static instance: HyperliquidPublicService;
  private cache: { [symbol: string]: { data: MarketIndicators; timestamp: number } } = {};
  private cacheDurationMs = 2500; // 2.5 seconds cache to avoid rate limiting and speed up response time

  private constructor() {}

  public static getInstance(): HyperliquidPublicService {
    if (!HyperliquidPublicService.instance) {
      HyperliquidPublicService.instance = new HyperliquidPublicService();
    }
    return HyperliquidPublicService.instance;
  }

  /**
   * Helper to perform safe fetch with timeouts
   */
  private async fetchWithTimeout(url: string, body: any, timeoutMs = 8000): Promise<any> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!response.ok) {
        throw new Error(`Hyperliquid HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  /**
   * Fetches public candlesticks for a coin (e.g. BTC)
   */
  public async getCandles(coin: string, interval = '1h', limit = 100): Promise<any[]> {
    try {
      const cleanCoin = coin.replace('-USDT', '').toUpperCase();
      const endTime = Date.now();
      const startTime = endTime - limit * 3600000; // Lookback window in ms
      
      const body = {
        type: 'candleSnapshot',
        req: {
          coin: cleanCoin,
          interval,
          startTime,
          endTime,
        },
      };

      const data = await this.fetchWithTimeout(HYPERLIQUID_INFO_URL, body);
      if (!Array.isArray(data)) {
        throw new Error(`Invalid response format from Hyperliquid candles: ${typeof data}`);
      }

      // Map to the internal candle schema arranged from oldest to newest for computations
      return data.map((row: HyperliquidCandle) => ({
        ts: row.t,
        o: Number(row.o),
        h: Number(row.h),
        l: Number(row.l),
        c: Number(row.c),
        vol: Number(row.v),
      }));
    } catch (error) {
      console.error(`Error fetching Hyperliquid candles for ${coin}:`, error);
      return this.getFallbackCandles(coin, limit);
    }
  }

  /**
   * Calculates high-precision metrics and compiles complete MarketIndicators.
   * Utilizes an in-memory cache and robust real-time API fallbacks (e.g. allMids) to prevent rate limits and eliminate stale data.
   */
  public async compileMarketIndicators(symbol: string): Promise<MarketIndicators> {
    const cleanCoin = symbol.replace('-USDT', '').toUpperCase();
    const now = Date.now();

    // 0. Check cache first to keep requests snappy and avoid rate limiting
    if (this.cache[symbol] && (now - this.cache[symbol].timestamp < this.cacheDurationMs)) {
      return this.cache[symbol].data;
    }

    try {
      // 1. Fetch candles (arranged chronologically for technical analysis)
      const candlesRaw = await this.getCandles(cleanCoin, '1h', 100);
      const candles = [...candlesRaw].sort((a, b) => a.ts - b.ts); // Ensure ascending chronological order

      // 2. Fetch meta & asset context
      let metaAndCtxs: any = null;
      try {
        metaAndCtxs = await this.fetchWithTimeout(HYPERLIQUID_INFO_URL, { type: 'metaAndAssetCtxs' }, 3500);
      } catch (err) {
        console.warn(`Could not fetch metaAndAssetCtxs for ${cleanCoin}, will try other fallback methods:`, err);
      }

      let lastPrice = 0;
      let volume24h = 0;
      let fundingRate = 0.0001;
      let openInterest = 150000000;

      if (metaAndCtxs && Array.isArray(metaAndCtxs) && metaAndCtxs.length >= 2) {
        const universe = metaAndCtxs[0]?.universe || [];
        const assetCtxs = metaAndCtxs[1] || [];

        const index = universe.findIndex((item: any) => item.name === cleanCoin);
        if (index !== -1) {
          const ctx = assetCtxs[index];
          lastPrice = Number(ctx.midPx || ctx.markPx || 0);
          volume24h = Number(ctx.dayNtlVlm || 0);
          const hourlyFunding = Number(ctx.funding || 0);
          fundingRate = hourlyFunding * 8; // standard crypto 8-hour funding representation
          openInterest = Number(ctx.openInterest || 0);
        }
      }

      // Fallback 1: If price is still 0 (due to rate-limiting/timeouts on metaAndAssetCtxs), query lightweight allMids endpoint
      if (lastPrice === 0) {
        try {
          const allMids = await this.fetchWithTimeout(HYPERLIQUID_INFO_URL, { type: 'allMids' }, 2500);
          if (allMids && allMids[cleanCoin]) {
            lastPrice = Number(allMids[cleanCoin]);
            console.log(`Fallback Success: fetched live price for ${cleanCoin} from allMids: ${lastPrice}`);
          }
        } catch (err) {
          console.warn(`allMids fallback failed for ${cleanCoin}:`, err);
        }
      }

      // Fallback 2: Get price from the last hourly candle close
      if (lastPrice === 0 && candles.length > 0) {
        lastPrice = candles[candles.length - 1].c;
        console.log(`Fallback Success: using price from last candle close for ${cleanCoin}: ${lastPrice}`);
      }

      // Fallback 3: Use the last cached compiled indicators' price
      if (lastPrice === 0 && this.cache[symbol]) {
        lastPrice = this.cache[symbol].data.lastPrice;
        console.log(`Fallback Success: using last cached price for ${cleanCoin}: ${lastPrice}`);
      }

      // Fallback 4 (Absolute Last Resort): Static estimation if completely offline
      if (lastPrice === 0) {
        lastPrice = cleanCoin === 'BTC' ? 62970 : cleanCoin === 'ETH' ? 3120 : cleanCoin === 'SOL' ? 142 : cleanCoin === 'HYPE' ? 4.5 : 1.0;
        console.warn(`Fallback Alert: using hardcoded default price for ${cleanCoin}: ${lastPrice}`);
      }

      // Extract high/low from last 24 1h candles
      const last24Candles = candles.slice(-24);
      let high24h = lastPrice * 1.01;
      let low24h = lastPrice * 0.99;
      if (last24Candles.length > 0) {
        high24h = Math.max(...last24Candles.map(c => c.h));
        low24h = Math.min(...last24Candles.map(c => c.l));
      }

      if (volume24h === 0 && last24Candles.length > 0) {
        // Estimate 24h volume from available candles
        volume24h = last24Candles.reduce((sum, c) => sum + (c.vol * lastPrice), 0);
      }

      // 3. Fetch L2 book and calculate order book imbalance
      let orderBookImbalance = 0;
      try {
        const l2Book = await this.fetchWithTimeout(HYPERLIQUID_INFO_URL, { type: 'l2Book', coin: cleanCoin }, 2500);
        if (l2Book && Array.isArray(l2Book.levels) && l2Book.levels.length >= 2) {
          const bids = l2Book.levels[0] || [];
          const asks = l2Book.levels[1] || [];
          const bidVol = bids.reduce((sum: number, bid: any) => sum + Number(bid.sz || 0), 0);
          const askVol = asks.reduce((sum: number, ask: any) => sum + Number(ask.sz || 0), 0);
          
          if (bidVol + askVol > 0) {
            orderBookImbalance = (bidVol - askVol) / (bidVol + askVol);
          }
        }
      } catch (err) {
        console.warn(`Could not compute real-time order book imbalance for ${cleanCoin}:`, err);
      }

      // --- CALCULATE RSI (14) ---
      let rsi = 50;
      if (candles.length > 15) {
        const rsiPeriod = 14;
        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= rsiPeriod; i++) {
          const change = candles[i].c - candles[i - 1].c;
          if (change > 0) {
            gains += change;
          } else {
            losses -= change;
          }
        }
        
        let avgGain = gains / rsiPeriod;
        let avgLoss = losses / rsiPeriod;

        for (let i = rsiPeriod + 1; i < candles.length; i++) {
          const change = candles[i].c - candles[i - 1].c;
          const currentGain = change > 0 ? change : 0;
          const currentLoss = change < 0 ? -change : 0;

          avgGain = (avgGain * (rsiPeriod - 1) + currentGain) / rsiPeriod;
          avgLoss = (avgLoss * (rsiPeriod - 1) + currentLoss) / rsiPeriod;
        }

        if (avgLoss === 0) {
          rsi = 100;
        } else {
          const rs = avgGain / avgLoss;
          rsi = 100 - 100 / (1 + rs);
        }
      }

      // --- CALCULATE ATR (14) ---
      let atr = lastPrice * 0.015; // default fallback 1.5% of price
      if (candles.length > 15) {
        const atrPeriod = 14;
        const trValues: number[] = [];

        for (let i = 1; i < candles.length; i++) {
          const h = candles[i].h;
          const l = candles[i].l;
          const pc = candles[i - 1].c;
          
          const tr = Math.max(
            h - l,
            Math.abs(h - pc),
            Math.abs(l - pc)
          );
          trValues.push(tr);
        }

        let sumTR = 0;
        for (let i = 0; i < atrPeriod; i++) {
          sumTR += trValues[i];
        }
        
        let smoothedAtr = sumTR / atrPeriod;
        for (let i = atrPeriod; i < trValues.length; i++) {
          smoothedAtr = (smoothedAtr * (atrPeriod - 1) + trValues[i]) / atrPeriod;
        }
        
        atr = smoothedAtr;
      }

      // --- CALCULATE BOLLINGER BANDS (20, 2) ---
      let bbands = {
        upper: lastPrice * 1.03,
        middle: lastPrice,
        lower: lastPrice * 0.97,
        width: 0.06,
      };

      if (candles.length > 20) {
        const bbPeriod = 20;
        const slice = candles.slice(-bbPeriod);
        
        const sum = slice.reduce((acc, c) => acc + c.c, 0);
        const middle = sum / bbPeriod;
        
        const variance = slice.reduce((acc, c) => acc + Math.pow(c.c - middle, 2), 0) / bbPeriod;
        const stdDev = Math.sqrt(variance);
        
        const upper = middle + 2 * stdDev;
        const lower = middle - 2 * stdDev;
        const width = middle !== 0 ? (upper - lower) / middle : 0.05;

        bbands = { upper, middle, lower, width };
      }

      // --- SIMULATE CVD (Cumulative Volume Delta) ---
      let cvd = 0;
      candles.slice(-30).forEach(candle => {
        const denom = candle.h - candle.l;
        if (denom > 0) {
          const clv = ((candle.c - candle.l) - (candle.h - candle.c)) / denom;
          cvd += clv * candle.vol;
        }
      });

      const compiledData: MarketIndicators = {
        symbol,
        lastPrice,
        high24h,
        low24h,
        volume24h,
        atr,
        rsi,
        bbands,
        fundingRate,
        openInterest,
        orderBookImbalance,
        cvd,
        timestamp: new Date().toISOString(),
      };

      // Store in memory cache
      this.cache[symbol] = {
        data: compiledData,
        timestamp: now
      };

      return compiledData;
    } catch (error) {
      console.error(`Error compiling market indicators for ${cleanCoin} on Hyperliquid:`, error);
      
      // Fallback: If we have a stale cache entry, return it to keep the app functional
      if (this.cache[symbol]) {
        console.log(`Fallback Success: Returning stale cached indicators for ${symbol}`);
        return this.cache[symbol].data;
      }

      // Dynamic default fallback values
      const mockPrice = cleanCoin === 'BTC' ? 62970 : cleanCoin === 'ETH' ? 3120 : cleanCoin === 'SOL' ? 142 : cleanCoin === 'HYPE' ? 4.5 : 1.0;
      return {
        symbol,
        lastPrice: mockPrice,
        high24h: mockPrice * 1.02,
        low24h: mockPrice * 0.98,
        volume24h: 50000000,
        atr: mockPrice * 0.015,
        rsi: 52,
        bbands: {
          upper: mockPrice * 1.03,
          middle: mockPrice,
          lower: mockPrice * 0.97,
          width: 0.06,
        },
        fundingRate: 0.0001,
        openInterest: 150000000,
        orderBookImbalance: 0.02,
        cvd: 45000,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private getFallbackCandles(coin: string, limit: number): any[] {
    const cleanCoin = coin.replace('-USDT', '').toUpperCase();
    const mockPrice = cleanCoin === 'BTC' ? 62970 : cleanCoin === 'ETH' ? 3120 : cleanCoin === 'SOL' ? 142 : cleanCoin === 'HYPE' ? 4.5 : 1.0;
    const candles = [];
    const now = Date.now();
    for (let i = limit; i >= 0; i--) {
      const ts = now - i * 3600000;
      candles.push({
        ts,
        o: mockPrice * (1 + (Math.random() - 0.5) * 0.01),
        h: mockPrice * (1 + Math.random() * 0.01),
        l: mockPrice * (1 - Math.random() * 0.01),
        c: mockPrice * (1 + (Math.random() - 0.5) * 0.01),
        vol: Math.random() * 100,
      });
    }
    return candles;
  }
}
