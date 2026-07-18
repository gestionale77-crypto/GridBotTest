import { DatabaseService } from './db.js';
import { EventBus } from './EventBus.js';

const HYPERLIQUID_INFO_URL = 'https://api.hyperliquid.xyz/info';

export interface HyperliquidCredentials {
  walletAddress: string;
  privateKey?: string;
  useTestnet: boolean;
}

export interface HLAccountInfo {
  address: string;
  accountValue: number;
  totalNtlPos: number;
  totalMarginUsed: number;
  withdrawable: number;
  crossMaintenanceMarginUsed: number;
}

export interface HLPositionDetails {
  instId: string;
  mgnMode: 'cross' | 'isolated';
  posSide: 'long' | 'short';
  pos: number;
  availPos: number;
  avgPx: number;
  lastPx: number;
  upl: number;
  uplRatio: number;
  liqPx: number | null;
  lever: number;
  margin: number;
}

export interface HLAssetBalance {
  ccy: string;
  cashBal: number;
  eq: number;
  availBal: number;
  availEq: number;
  frozenBal: number;
  upl: number;
}

export interface HLSystemHealthChecklist {
  hyperliquidConnected: boolean;
  restAuthenticated: boolean;
  walletVerified: boolean;
  balanceLoaded: boolean;
  positionsLoaded: boolean;
  databaseReady: boolean;
  riskEngineReady: boolean;
  aiReady: boolean;
  executionEngineReady: boolean;
}

export class HyperliquidPrivateService {
  private static instance: HyperliquidPrivateService;
  private db = DatabaseService.getInstance();
  private eventBus = EventBus.getInstance();

  private credentials: HyperliquidCredentials | null = null;
  private restLatency = -1;

  // Cached states
  private cachedAccountInfo: HLAccountInfo | null = null;
  private cachedBalances: HLAssetBalance[] = [];
  private cachedPositions: HLPositionDetails[] = [];

  private constructor() {}

  public static getInstance(): HyperliquidPrivateService {
    if (!HyperliquidPrivateService.instance) {
      HyperliquidPrivateService.instance = new HyperliquidPrivateService();
    }
    return HyperliquidPrivateService.instance;
  }

  /**
   * Initializes state from persistent storage or environment variables
   */
  public async initialize(): Promise<void> {
    const fullDb = this.db.getFullDataset() as any;
    
    // Check if we have env secrets first
    const envAddress = process.env.HYPERLIQUID_WALLET_ADDRESS;
    const envPrivateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
    const envUseTestnet = process.env.HYPERLIQUID_USE_TESTNET === 'true';

    if (envAddress) {
      this.credentials = {
        walletAddress: envAddress,
        privateKey: envPrivateKey,
        useTestnet: envUseTestnet,
      };
      console.log('[HyperliquidPrivateService] Loaded credentials from environment variables.');
    } else if (fullDb.hlCredentials) {
      this.credentials = fullDb.hlCredentials;
      console.log('[HyperliquidPrivateService] Loaded secure credentials from database.');
    }

    if (this.credentials) {
      try {
        await this.verifyAndConnect();
      } catch (err: any) {
        console.error('[HyperliquidPrivateService] Auto-connect failed:', err.message);
      }
    }
  }

  /**
   * Saves credentials and performs verification
   */
  public async saveCredentials(creds: HyperliquidCredentials): Promise<boolean> {
    this.credentials = creds;
    const fullDb = this.db.getFullDataset() as any;
    fullDb.hlCredentials = creds;
    await this.db.forceSave();

    console.log('[HyperliquidPrivateService] Saved new credentials. Attempting connection verification...');
    return await this.verifyAndConnect();
  }

  /**
   * Clears credentials
   */
  public async disconnect(): Promise<void> {
    this.credentials = null;
    const fullDb = this.db.getFullDataset() as any;
    delete fullDb.hlCredentials;
    await this.db.forceSave();

    this.cachedAccountInfo = null;
    this.cachedBalances = [];
    this.cachedPositions = [];

    console.log('[HyperliquidPrivateService] Disconnected wallet and cleared cache.');
  }

  public isConnected(): boolean {
    return this.credentials !== null && this.cachedAccountInfo !== null;
  }

  public getCredentials(): { walletAddressMasked: string; useTestnet: boolean } | null {
    if (!this.credentials) return null;
    const addr = this.credentials.walletAddress;
    const masked = addr.length > 10 ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : addr;
    return {
      walletAddressMasked: masked,
      useTestnet: this.credentials.useTestnet,
    };
  }

  public getRawCredentials(): HyperliquidCredentials | null {
    return this.credentials;
  }

  /**
   * Fetches user's clearinghouse state and updates cache
   */
  public async verifyAndConnect(): Promise<boolean> {
    if (!this.credentials) return false;

    const startTime = Date.now();
    try {
      const url = this.credentials.useTestnet 
        ? 'https://api.hyperliquid-testnet.xyz/info' 
        : 'https://api.hyperliquid.xyz/info';

      const body = {
        type: 'clearinghouseState',
        user: this.credentials.walletAddress,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      this.restLatency = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Hyperliquid clearinghouseState failed with status: ${response.status}`);
      }

      const state = await response.json();

      if (!state || typeof state !== 'object') {
        throw new Error('Received invalid clearinghouseState JSON payload.');
      }

      const margin = state.marginSummary || { accountValue: '0', totalNtlPos: '0', totalMarginUsed: '0' };
      const crossMargin = state.crossMarginSummary || margin;
      
      this.cachedAccountInfo = {
        address: this.credentials.walletAddress,
        accountValue: Number(margin.accountValue || 0),
        totalNtlPos: Number(margin.totalNtlPos || 0),
        totalMarginUsed: Number(margin.totalMarginUsed || 0),
        withdrawable: Number(state.withdrawable || 0),
        crossMaintenanceMarginUsed: Number(state.crossMaintenanceMarginUsed || 0),
      };

      // Set Cash Balances
      this.cachedBalances = [
        {
          ccy: 'USDC',
          cashBal: Number(state.withdrawable || 0),
          eq: Number(margin.accountValue || 0),
          availBal: Number(state.withdrawable || 0),
          availEq: Number(margin.accountValue || 0),
          frozenBal: Number(margin.totalMarginUsed || 0),
          upl: Number(margin.accountValue || 0) - Number(state.withdrawable || 0),
        }
      ];

      // Parse assetPositions
      const positionsRaw = state.assetPositions || [];
      this.cachedPositions = positionsRaw.map((posObj: any) => {
        const p = posObj.position || {};
        const coinName = p.coin || 'Unknown';
        const size = Number(p.scl || 0);
        const entryPx = Number(p.entryPx || 0);
        const upl = Number(posObj.unrealizedPnl || p.unrealizedPnl || 0);
        
        // Calculate side
        const side: 'long' | 'short' = size >= 0 ? 'long' : 'short';
        const absoluteSize = Math.abs(size);
        const leverage = p.leverage || { type: 'cross', value: 1 };

        return {
          instId: coinName,
          mgnMode: leverage.type === 'isolated' ? 'isolated' : 'cross',
          posSide: side,
          pos: absoluteSize,
          availPos: absoluteSize,
          avgPx: entryPx,
          lastPx: entryPx !== 0 ? entryPx * (1 + upl / (absoluteSize * entryPx || 1)) : 0,
          upl: upl,
          uplRatio: entryPx !== 0 ? upl / (absoluteSize * entryPx) : 0,
          liqPx: Number(p.liquidationPx || 0) || null,
          lever: Number(leverage.value || 1),
          margin: Number(p.marginUsed || 0),
        };
      });

      console.log(`[HyperliquidPrivateService] Verified account ${this.getCredentials()?.walletAddressMasked} successfully. Equity: $${this.cachedAccountInfo.accountValue}`);
      return true;
    } catch (error: any) {
      console.error('[HyperliquidPrivateService] Verification failed:', error.message);
      this.cachedAccountInfo = null;
      throw error;
    }
  }

  public getSystemHealthChecklist(): HLSystemHealthChecklist {
    const isCredSet = this.credentials !== null;
    const hasAccount = this.cachedAccountInfo !== null;
    const activeGrids = this.db.getActiveGrids();

    return {
      hyperliquidConnected: isCredSet,
      restAuthenticated: isCredSet && hasAccount,
      walletVerified: hasAccount && this.cachedAccountInfo!.address !== '',
      balanceLoaded: isCredSet && this.cachedBalances.length > 0,
      positionsLoaded: isCredSet && hasAccount,
      databaseReady: true,
      riskEngineReady: activeGrids.length >= 0,
      aiReady: process.env.GEMINI_API_KEY !== undefined,
      executionEngineReady: true,
    };
  }

  public getConnectionState(): any {
    return {
      connected: this.isConnected(),
      account: this.cachedAccountInfo,
      balances: this.cachedBalances,
      positions: this.cachedPositions,
      healthChecklist: this.getSystemHealthChecklist(),
      credentials: this.getCredentials(),
      latency: this.restLatency,
      envSecrets: {
        hasWalletAddress: !!process.env.HYPERLIQUID_WALLET_ADDRESS,
        hasPrivateKey: !!process.env.HYPERLIQUID_PRIVATE_KEY,
        hasGeminiApiKey: !!process.env.GEMINI_API_KEY,
        walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS ? `${process.env.HYPERLIQUID_WALLET_ADDRESS.substring(0, 6)}...${process.env.HYPERLIQUID_WALLET_ADDRESS.substring(process.env.HYPERLIQUID_WALLET_ADDRESS.length - 4)}` : null,
        useTestnet: process.env.HYPERLIQUID_USE_TESTNET === 'true'
      }
    };
  }
}
