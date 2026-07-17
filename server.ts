import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { DatabaseService } from './src/services/db.js';
import { HyperliquidPublicService } from './src/services/hyperliquidPublic.js';
import { HyperliquidPrivateService } from './src/services/hyperliquidPrivate.js';
import { AIService } from './src/services/ai.js';
import { GridEngineService } from './src/services/gridEngine.js';
import { NewsService } from './src/services/news.js';

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
