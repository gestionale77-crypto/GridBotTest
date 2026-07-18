import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Load environment variables immediately
dotenv.config();

import { DatabaseService } from './src/services/db.js';
import { HyperliquidPublicService } from './src/services/hyperliquidPublic.js';
import { HyperliquidPrivateService } from './src/services/hyperliquidPrivate.js';
import { AIService } from './src/services/ai.js';
import { GridEngineService } from './src/services/gridEngine.js';
import { NewsService } from './src/services/news.js';
import { HyperliquidGridEngine } from './backend/core/GridEngine.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // Initialize Services
  const db = DatabaseService.getInstance();
  await db.initialize();

  const hlPrivate = HyperliquidPrivateService.getInstance();
  await hlPrivate.initialize();

  const gridEngine = GridEngineService.getInstance();
  gridEngine.start();

  const hyperliquid = HyperliquidPublicService.getInstance();
  const ai = AIService.getInstance();
  const news = NewsService.getInstance();

  // ----------------------------------------
  // API ROUTES
  // ----------------------------------------

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Get compiled market indicators
  app.get('/api/market-indicators', async (req, res) => {
    try {
      const symbol = (req.query.symbol as string) || 'BTC-USDT';
      const indicators = await hyperliquid.compileMarketIndicators(symbol);
      res.json(indicators);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error fetching indicators' });
    }
  });

  // Analyze regime & generate strategy with Gemini
  app.post('/api/analyze-regime', async (req, res) => {
    try {
      const { symbol, userIntent } = req.body;
      if (!symbol || !userIntent) {
        return res.status(400).json({ error: 'Missing required parameters: symbol, userIntent' });
      }

      // Fetch latest metrics and news concurrently
      const [indicators, newsItems] = await Promise.all([
        hyperliquid.compileMarketIndicators(symbol),
        news.getLatestCryptoNews(30)
      ]);
      
      const newsSentiment = await ai.analyzeNewsSentiment(newsItems);

      // Analyze with AI
      const strategy = await ai.analyzeMarketAndGenerateStrategy(indicators, userIntent, newsSentiment);
      
      res.json({ indicators, strategy });
    } catch (error: any) {
      console.error('Error analyzing regime:', error);
      res.status(500).json({ error: error.message || 'Error analyzing regime' });
    }
  });

  // Get News and Sentiment Analysis
  app.get('/api/news-sentiment', async (req, res) => {
    try {
      const newsItems = await news.getLatestCryptoNews(30);
      const sentiment = await ai.analyzeNewsSentiment(newsItems);
      res.json({ news: newsItems.slice(0, 5), sentiment });
    } catch (error: any) {
      console.error('Error fetching news sentiment:', error);
      res.status(500).json({ error: error.message || 'Error fetching news sentiment' });
    }
  });

  // Get Multi-Model Mathematical Matrix (120+ indicators)
  app.get('/api/mathematical-matrix', async (req, res) => {
    try {
      const symbol = (req.query.symbol as string) || 'BTC-USDT';
      const [indicators, newsItems] = await Promise.all([
        hyperliquid.compileMarketIndicators(symbol),
        news.getLatestCryptoNews(30)
      ]);
      const sentiment = await ai.analyzeNewsSentiment(newsItems);
      const matrix = ai.calculateMathModelMatrix(indicators, sentiment);
      res.json({ matrix, indicators, sentiment, news: newsItems });
    } catch (error: any) {
      console.error('Error fetching mathematical matrix:', error);
      res.status(500).json({ error: error.message || 'Error fetching mathematical matrix' });
    }
  });

  // Narrate Market State (On-demand AI Narrative)
  app.post('/api/narrate-market', async (req, res) => {
    try {
      const { symbol, matrixSummary, userQuery } = req.body;
      const targetSymbol = symbol || 'BTC-USDT';
      const indicators = await hyperliquid.compileMarketIndicators(targetSymbol);
      const explanation = await ai.narrateMarketState(indicators, matrixSummary, userQuery);
      res.json({ explanation });
    } catch (error: any) {
      console.error('Error narrating market:', error);
      res.status(500).json({ error: error.message || 'Error narrating market' });
    }
  });

  // Deploy Grid Engine
  app.post('/api/deploy-grid', async (req, res) => {
    try {
      const { symbol, investment, userIntent, aiStrategy } = req.body;
      if (!symbol || !investment || !aiStrategy) {
        return res.status(400).json({ error: 'Missing deployment parameters' });
      }

      const gridConfig = await gridEngine.deployGrid({
        symbol,
        investment: Number(investment),
        userIntent,
        aiStrategy,
      });

      res.json({ success: true, grid: gridConfig });
    } catch (error: any) {
      console.error('Error deploying grid:', error);
      res.status(500).json({ error: error.message || 'Error deploying grid' });
    }
  });

  // Get active grids
  app.get('/api/active-grids', (req, res) => {
    try {
      res.json(db.getActiveGrids());
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error fetching active grids' });
    }
  });

  // Get levels of a grid
  app.get('/api/grid-levels', (req, res) => {
    try {
      const gridId = req.query.gridId as string;
      if (!gridId) {
        return res.status(400).json({ error: 'Missing gridId' });
      }
      res.json(db.getGridLevels(gridId));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error fetching grid levels' });
    }
  });

  // Get historical grids
  app.get('/api/historical-grids', (req, res) => {
    try {
      res.json(db.getHistoricalGrids());
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error fetching historical grids' });
    }
  });

  // Stop a grid
  app.post('/api/stop-grid', async (req, res) => {
    try {
      const { gridId } = req.body;
      if (!gridId) {
        return res.status(400).json({ error: 'Missing gridId' });
      }

      await db.stopGrid(gridId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error stopping grid' });
    }
  });

  // Get trades list
  app.get('/api/trades', (req, res) => {
    try {
      res.json(db.getTrades());
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error fetching trades' });
    }
  });

  // Get explanation reports for audibility
  app.get('/api/explanation-reports', (req, res) => {
    try {
      res.json(db.getExplanationReports());
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error fetching explanation reports' });
    }
  });

  // Get Risk Profile for a symbol
  app.get('/api/risk-profile', (req, res) => {
    try {
      const symbol = (req.query.symbol as string) || 'BTC-USDT';
      const risk = db.getRiskProfile(symbol);
      res.json(risk || {
        marginUsagePercent: 0,
        distanceToLiquidationPercent: 100,
        riskScore: 5,
        liquidationPrice: null,
        collateralRatio: 1,
        status: 'SAFE',
        recommendation: 'No active grids for this asset. Risk is negligible.'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error fetching risk profile' });
    }
  });

  // Trigger AI Self-Optimization
  app.get('/api/self-optimize', async (req, res) => {
    try {
      const fullDataset = db.getFullDataset();
      const optimizationResult = await ai.generateSelfOptimization(fullDataset);
      res.json(optimizationResult);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error running self-optimization' });
    }
  });

  // ----------------------------------------
  // PRIVATE HYPERLIQUID GATEWAY ENDPOINTS
  // ----------------------------------------

  // Get current Hyperliquid connection status and state
  app.get('/api/hl/state', (req, res) => {
    try {
      res.json(hlPrivate.getConnectionState());
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error fetching Hyperliquid state' });
    }
  });

  // Connect / save Hyperliquid credentials
  app.post('/api/hl/connect', async (req, res) => {
    try {
      const { walletAddress, privateKey, useTestnet } = req.body;
      if (!walletAddress) {
        return res.status(400).json({ error: 'Missing required credentials (walletAddress)' });
      }
      
      await hlPrivate.saveCredentials({
        walletAddress,
        privateKey,
        useTestnet: !!useTestnet
      });

      res.json(hlPrivate.getConnectionState());
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error connecting Hyperliquid wallet' });
    }
  });

  // Connect using environment variables / secrets
  app.post('/api/hl/connect-env', async (req, res) => {
    try {
      const envAddress = process.env.HYPERLIQUID_WALLET_ADDRESS;
      const envPrivateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
      const envUseTestnet = process.env.HYPERLIQUID_USE_TESTNET === 'true';

      if (!envAddress) {
        return res.status(400).json({ error: 'HYPERLIQUID_WALLET_ADDRESS is not set in environment secrets.' });
      }

      await hlPrivate.saveCredentials({
        walletAddress: envAddress,
        privateKey: envPrivateKey,
        useTestnet: envUseTestnet
      });

      res.json(hlPrivate.getConnectionState());
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error connecting Hyperliquid wallet via environment secrets' });
    }
  });

  // Disconnect / clear credentials
  app.post('/api/hl/disconnect', async (req, res) => {
    try {
      await hlPrivate.disconnect();
      res.json(hlPrivate.getConnectionState());
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error disconnecting Hyperliquid wallet' });
    }
  });

  // Test / refresh connection
  app.post('/api/hl/test-connection', async (req, res) => {
    try {
      await hlPrivate.verifyAndConnect();
      res.json(hlPrivate.getConnectionState());
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Hyperliquid wallet connection test failed' });
    }
  });

  // ----------------------------------------
  // ADVANCED GRID TRADING ENDPOINTS (OKX STYLE)
  // ----------------------------------------
  const activeAdvancedGrids = new Map<string, HyperliquidGridEngine>();

  app.post('/api/hl/deploy-grid', async (req, res) => {
    try {
      const creds = hlPrivate.getRawCredentials();
      if (!creds || !creds.walletAddress) {
        return res.status(400).json({ error: 'Please connect your Hyperliquid wallet before deploying a live grid.' });
      }

      const config = req.body;
      if (!config || !config.symbol || !config.lowerPrice || !config.upperPrice) {
        return res.status(400).json({ error: 'Missing critical grid parameters.' });
      }

      const gridId = `grid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      
      // Save config metadata to local DB for UI synchronization
      await db.saveGrid({
        id: gridId,
        status: 'ACTIVE',
        symbol: config.symbol,
        strategyType: 'GRID',
        regime: 'MEAN_REVERSION',
        strategyMode: config.direction === 'long' ? 'LONG_BIASED' : config.direction === 'short' ? 'SHORT_BIASED' : 'SYMMETRIC',
        levelsCount: config.gridCount,
        lowerPrice: Number(config.lowerPrice),
        upperPrice: Number(config.upperPrice),
        spacingType: 'FIXED_PERCENT',
        spacingValue: 0.01,
        gridSpacingPercent: 0.01,
        investment: Number(config.investment),
        leverage: Number(config.leverage),
        stopLoss: config.stopLossPercent ? Number(config.stopLossPercent) : null,
        takeProfit: null,
        hedgeRatio: 0,
        confidenceScore: 92,
        reasoning: 'Deployed via OKX-style Advanced Grid Panel with custom spacing and compound frequency.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalPnL: 0,
        roiPercent: 0
      });

      // Spawn Grid Engine
      const engine = new HyperliquidGridEngine(
        creds.walletAddress,
        creds.privateKey || '',
        config
      );

      // Save initial state to DB
      activeAdvancedGrids.set(gridId, engine);
      await engine.start();

      const engineState = engine.getEngineState();

      // Convert levels to StrategyLevel
      const strategyLevels = engineState.gridLevels.map((lvl: any, idx: number) => ({
        id: `lvl_${gridId}_${idx}`,
        strategyId: gridId,
        price: lvl.price,
        side: lvl.side as 'BUY' | 'SELL',
        size: lvl.sizeUsdt / lvl.price,
        sizeUsdt: lvl.sizeUsdt,
        status: 'PENDING' as const,
        executionPolicy: 'passive_limit',
        filledAt: null,
        orderId: null,
        txSignature: null
      }));

      await db.saveGridLevels(gridId, strategyLevels);

      res.json({
        success: true,
        gridId,
        state: engineState
      });
    } catch (error: any) {
      console.error('[DeployGrid] Error:', error.message);
      res.status(500).json({ error: error.message || 'Error deploying advanced grid' });
    }
  });

  app.get('/api/hl/active-grids', (req, res) => {
    try {
      const list: any[] = [];
      activeAdvancedGrids.forEach((engine, id) => {
        list.push({
          id,
          ...engine.getEngineState()
        });
      });
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error listing active advanced grids' });
    }
  });

  app.post('/api/hl/stop-grid', async (req, res) => {
    try {
      const { gridId } = req.body;
      if (!gridId) {
        return res.status(400).json({ error: 'Missing gridId' });
      }

      const engine = activeAdvancedGrids.get(gridId);
      if (engine) {
        await engine.stop();
        activeAdvancedGrids.delete(gridId);
      }

      await db.stopGrid(gridId);
      res.json({ success: true, gridId });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error stopping grid bot' });
    }
  });

  // ----------------------------------------
  // GLOBAL ERROR HANDLER & CRASH GUARDS
  // ----------------------------------------
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[Global Error Handler] Caught an error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      status: err.status || 500
    });
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Process] Uncaught Exception thrown:', err);
  });

  // ----------------------------------------
  // FRONTEND MIDDLEWARE CONFIGURATION
  // ----------------------------------------

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AIG ENGINE] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
