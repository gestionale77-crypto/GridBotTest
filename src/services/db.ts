import fs from 'fs/promises';
import path from 'path';
import { 
  StrategyConfig, 
  StrategyLevel, 
  TradeLog, 
  MarketIndicators, 
  RiskProfile, 
  IAQTSEngineState, 
  MarketSnapshot, 
  ExplanationReport 
} from '../types.js';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

interface ExtendedState extends IAQTSEngineState {
  marketSnapshots?: MarketSnapshot[];
  explanationReports?: ExplanationReport[];
}

const DEFAULT_STATE: ExtendedState = {
  activeGrids: [],
  gridLevels: {},
  historicalGrids: [],
  trades: [],
  marketIndicators: {},
  riskProfiles: {},
  marketSnapshots: [],
  explanationReports: []
};

export class DatabaseService {
  private static instance: DatabaseService;
  private state: ExtendedState = { ...DEFAULT_STATE };
  private initialized = false;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(DB_DIR, { recursive: true });

      try {
        const fileContent = await fs.readFile(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent) as ExtendedState;
        
        this.state = {
          activeGrids: parsed.activeGrids || [],
          gridLevels: parsed.gridLevels || {},
          historicalGrids: parsed.historicalGrids || [],
          trades: parsed.trades || [],
          marketIndicators: parsed.marketIndicators || {},
          riskProfiles: parsed.riskProfiles || {},
          marketSnapshots: parsed.marketSnapshots || [],
          explanationReports: parsed.explanationReports || []
        };
      } catch (err) {
        await this.saveState(DEFAULT_STATE);
        this.state = { ...DEFAULT_STATE };
      }
      this.initialized = true;
    } catch (error) {
      console.error('Database initialization error:', error);
      this.state = { ...DEFAULT_STATE };
      this.initialized = true;
    }
  }

  private async save(): Promise<void> {
    await this.saveState(this.state);
  }

  private async saveState(state: ExtendedState): Promise<void> {
    try {
      await fs.mkdir(DB_DIR, { recursive: true });
      await fs.writeFile(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving state to database file:', error);
    }
  }

  // Get active strategies
  public getActiveGrids(): StrategyConfig[] {
    return this.state.activeGrids;
  }

  // Get strategy by ID
  public getGrid(id: string): StrategyConfig | undefined {
    return this.state.activeGrids.find((g) => g.id === id) || this.state.historicalGrids.find((g) => g.id === id);
  }

  // Save or update an active strategy
  public async saveGrid(grid: StrategyConfig): Promise<void> {
    if (!grid) {
      await this.save();
      return;
    }
    const index = this.state.activeGrids.findIndex((g) => g.id === grid.id);
    if (index >= 0) {
      this.state.activeGrids[index] = grid;
    } else {
      this.state.activeGrids.push(grid);
    }
    await this.save();
  }

  public async forceSave(): Promise<void> {
    await this.save();
  }

  // Save levels for a strategy
  public async saveGridLevels(gridId: string, levels: StrategyLevel[]): Promise<void> {
    this.state.gridLevels[gridId] = levels;
    await this.save();
  }

  // Get levels for a strategy
  public getGridLevels(gridId: string): StrategyLevel[] {
    return this.state.gridLevels[gridId] || [];
  }

  // Deactivate a strategy and archive it
  public async stopGrid(gridId: string): Promise<void> {
    const index = this.state.activeGrids.findIndex((g) => g.id === gridId);
    if (index >= 0) {
      const grid = this.state.activeGrids[index];
      grid.status = 'STOPPED';
      grid.updatedAt = new Date().toISOString();
      
      this.state.historicalGrids.push(grid);
      this.state.activeGrids.splice(index, 1);
      
      const levels = this.state.gridLevels[gridId] || [];
      levels.forEach(lvl => {
        if (lvl.status === 'PENDING') {
          lvl.status = 'CANCELLED';
        }
      });
      this.state.gridLevels[gridId] = levels;

      await this.save();
    }
  }

  // Get historical strategies
  public getHistoricalGrids(): StrategyConfig[] {
    return this.state.historicalGrids;
  }

  // Add a trade log entry (Trade Memory)
  public async addTrade(trade: TradeLog): Promise<void> {
    this.state.trades.unshift(trade);
    await this.save();
  }

  // Get trades list
  public getTrades(): TradeLog[] {
    return this.state.trades;
  }

  // Set market indicators for a symbol
  public async saveMarketIndicators(symbol: string, indicators: MarketIndicators): Promise<void> {
    this.state.marketIndicators[symbol] = indicators;
    await this.save();
  }

  // Get market indicators for a symbol
  public getMarketIndicators(symbol: string): MarketIndicators | undefined {
    return this.state.marketIndicators[symbol];
  }

  // Set risk profile for a symbol
  public async saveRiskProfile(symbol: string, profile: RiskProfile): Promise<void> {
    this.state.riskProfiles[symbol] = profile;
    await this.save();
  }

  // Get risk profile for a symbol
  public getRiskProfile(symbol: string): RiskProfile | undefined {
    return this.state.riskProfiles[symbol];
  }

  // Chronological Market Snapshot (Market Memory)
  public async saveMarketSnapshot(snapshot: MarketSnapshot): Promise<void> {
    if (!this.state.marketSnapshots) {
      this.state.marketSnapshots = [];
    }
    this.state.marketSnapshots.push(snapshot);
    await this.save();
  }

  public getMarketSnapshots(): MarketSnapshot[] {
    return this.state.marketSnapshots || [];
  }

  // Explainability Audit Reports (Explainability Engine)
  public async saveExplanationReport(report: ExplanationReport): Promise<void> {
    if (!this.state.explanationReports) {
      this.state.explanationReports = [];
    }
    this.state.explanationReports.push(report);
    await this.save();
  }

  public getExplanationReports(): ExplanationReport[] {
    return this.state.explanationReports || [];
  }

  // Export full raw DB for self-optimization
  public getFullDataset(): ExtendedState {
    return this.state;
  }
}
