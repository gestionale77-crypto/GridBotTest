# Technical Design Document (TDD)
## Project: Institutional Adaptive Quantitative Trading System (IAQTS)
**Version:** 1.0.1  
**Role:** Senior Staff Software Engineer & Product Architect  
**Classification:** Confidential - Proprietary Quantitative Engine

---

## 1. Executive Summary & Vision

The **Adaptive Grid Engine** is upgraded and refactored into the **Institutional Adaptive Quantitative Trading System (IAQTS)**. 

### Core Shift
The system shifts away from a simple, isolated, simulated loop to a **highly scalable, production-grade, event-driven quantitative engine**. Every single transaction, indicator, and order state transition follows strict institutional guidelines. We completely reject low-fidelity simulated fills; the engine interacts with the database, private state managers, and public/private exchange interfaces (OKX API & WebSocket event-driven loops that strictly mimic the exact state transitions of a real exchange).

### Core Specifications
This Technical Design Document acts as the master directory of the IAQTS architecture and references three specialized specifications:
1.  **[Quantitative Trading Specification (QTS)](/QTS.md):** Defines our 15-regime classification framework, multi-strategy compilation options, and our 3-tiered Memory Architecture.
2.  **[Execution Specification](/EXECUTION_SPEC.md):** Defines our ten microstructural execution policies (maker only, aggressive IOCs, iceberg, sweeps, etc.).
3.  **[Risk Specification](/RISK_SPEC.md):** Defines our 10 hard-coded safety bounds (Max Daily Loss, weekly/monthly drawdown limits, leverage caps, etc.).

---

## 2. Updated Architectural Pillars & Solutions

### Pillar 1: Pure Event-Driven Order Lifecycle (No Mock Fills)
*   **The Solution:** Implement a strict, asynchronous state machine mimicking high-frequency trading (HFT) connectivity.
*   Orders exist in the database with status `PENDING`. They are only marked as `FILLED` when the exchange gateway or a high-fidelity mock-exchange WebSocket state machine matches orderbook depth with real execution slippage.

### Pillar 2: The Septem-Core AI Engine Pipeline (7-Stage Inference)
Instead of a single unstructured analysis, decision-making is modularized across seven specialized AI sub-modules, which feed into each other sequentially:
1.  **Market Intelligence AI:** Extracts multi-timeframe microstructural indicators, order flow imbalance, bid-ask spread velocity, and premium deviations.
2.  **Market Regime AI:** Classifies the asset's macroeconomic state (exactly matching our 15 QTS Regimes).
3.  **Risk AI:** Evaluates distance to liquidation, systemic exposure, collateral margin ratio, and historical value-at-risk (VaR).
4.  **Strategy AI:** Outlines optimal execution variables, selecting the ideal modular strategy (Grid, DCA, TWAP, VWAP, Basis, Carry, MM, LP).
5.  **Position Sizing AI:** Calculates fractional sizing using Kelly Criterion, volatility scales, and current capital efficiency instead of flat values.
6.  **Execution AI:** Matches trading needs with specific microstructural execution policies (Maker Only, Iceberg, Sweeps, passive posts).
7.  **Learning AI / Self-Optimizer:** Sifts through trade, market, and knowledge memory to suggest adjustments.

### Pillar 3: Central System Event Bus (EDA)
The system operates on an asynchronous `EventEmitter` event loop. Active components subscribe to particular channels:
*   `TICKER_UPDATE`: Instant price and depth changes.
*   `ORDERBOOK_UPDATE`: Bid/Ask depth shifts.
*   `ORDER_FILLED` / `ORDER_CANCELLED`: Ledger updates.
*   `PORTFOLIO_DRIFT`: Net delta boundaries exceeded.
*   `SYSTEM_OPTIMIZE`: Learning engine triggers.

### Pillar 4: The Strategy Compiler Pattern (Immutability & Compile-On-Demand)
*   Strategies are compiled as immutable, ephemeral constructs.
*   When a regime drift or portfolio risk check triggers, the active strategy is marked as `TERMINATED`, existing orders are cancelled, and the **Strategy Compiler** compiles a fresh setup (`Analyze` -> `Validate` -> `Risk Check` -> `Deploy`).

### Pillar 5: Position Sizing Engine (Fractional & Volatility-Adjusted)
*   Instead of deploying standard, hardcoded sizes (e.g. 10 USDT per level), sizes are dynamic:
    $$\text{Size} = f(\text{Capital}, \text{Regime Volatility}, \text{ATR}, \text{Distance to Mid})$$
*   Levels closer to major support/resistance clusters get higher capital allocation with precise micro-fractional positions (e.g. `8.37` USDT or `12.41` USDT).

### Pillar 6: Cross-Asset Portfolio Manager (Systemic Delta Control)
*   Coordinates exposures across all active assets (BTC, ETH, SOL).
*   Calculates **Total Portfolio Delta**, **Beta-adjusted exposure**, and correlation metrics to ensure a single directional movement does not cause cascading liquidations.

### Pillar 7: Three-Layer Deep Memory Ledger
Every epoch logs across three structured tables/collections in DB/Memory:
*   **Trade Memory:** Detailed execution logs (Entry/Exit price, exact fees, execution latency, and slippage).
*   **Market Memory:** Chronicled microstructural snapshots (ATR, Spread, Funding, CVD, Open Interest, volatility coefficients).
*   **Knowledge Memory:** Extracted multi-factor semantic rules (patterns, success probabilities, and recommended configurations).

### Pillar 8: Explainability Engine
Every trading decision, strategy compilation, or position sizing revision must generate a detailed cryptographic **Explanation Audit Report** that is persisted in the database:
```typescript
interface ExplanationReport {
  decisionId: string;
  timestamp: string;
  symbol: string;
  strategyType: string;
  reason: string;
  confidence: number;
  riskScore: number;
  marketRegime: string;
  expectedRoi: number;
  expectedDrawdown: number;
  expectedHoldingTime: string;
  whyNotAlternative: string;
  sourcesUsed: string[];
  indicatorsUsed: { [key: string]: number | string };
  aiVersion: string;
}
```

---

## 3. Structural File and Folder Blueprint

To enforce strict separation of concerns, the workspace directories will be organized as follows:

```text
/src
├── App.tsx                   # Main Unified Workspace Dashboard
├── index.css                 # Global CSS (Sophisticated Dark tailwind configs)
├── types.ts                  # Shared Global TypeScript Enums, Interfaces & Specs
├── components/               # Pure UI Display Layers
│   ├── MarketIntelligence.tsx # Visual depth gauges and indicators
│   ├── DeployGridPanel.tsx    # Strategy compilation interface
│   ├── ActiveGridsPanel.tsx   # Active engines visualizer
│   ├── SelfOptimizationPanel.tsx # Parameter tuning interface
│   └── TradesLogPanel.tsx     # Cryptographic execution ledger
├── services/                 # Business & Algorithmic Logic
│   ├── EventBus.ts           # Central EDA Event Hub
│   ├── PortfolioManager.ts   # Multi-asset Delta, Beta & risk limits controller
│   ├── PositionSizer.ts      # Fractional allocation & Volatility scaler
│   ├── StrategyCompiler.ts   # Ephemeral Strategy Generator & Validator
│   ├── ExplainabilityEngine.ts# Explanation Report Generator & Logger
│   ├── okxClient.ts          # Authentic exchange API client
│   ├── db.ts                 # Database persistence layer (Active, Ledger, Snapshots, Reports)
│   └── ai/                   # The Septem-Core AI Pipelines
│       ├── index.ts          # Core Orchestrator
│       ├── intelligence.ts   # Market Intelligence sub-engine
│       ├── regime.ts         # Regime classification sub-engine
│       ├── risk.ts           # Risk & margin threshold sub-engine
│       ├── strategy.ts       # Grid spacing & parameter sub-engine
│       ├── sizer.ts          # Fractional size calculator sub-engine
│       ├── execution.ts      # Algorithm & execution sub-engine
│       └── learning.ts       # Learning feed & historical memory parser
```

---

## 4. DB Schema & Ledger Specifications

### 1. Active Strategies Collection (`strategy_configs`)
Tracks running instances of quantitative strategies with strict state definitions:
```typescript
interface StrategyConfig {
  id: string;
  symbol: string;
  strategyType: 'GRID' | 'DCA' | 'TWAP' | 'VWAP' | 'BASIS' | 'CARRY' | 'MM' | 'LP';
  status: 'PENDING' | 'RUNNING' | 'TERMINATED' | 'LIQUIDATED';
  regime: string;
  confidenceScore: number;
  investment: number;
  leverage: number;
  lowerPrice: number;
  upperPrice: number;
  spacingType: 'ATR_BASED' | 'PERCENTAGE';
  spacingValue: number;
  hedgeRatio: number;
  totalPnL: number;
  roiPercent: number;
  createdAt: string;
}
```

### 2. Live Strategy Orders Collection (`strategy_levels`)
Defines individual order coordinates, mapped to real or simulated-match pending states:
```typescript
interface StrategyLevel {
  id: string;
  strategyId: string;
  price: number;
  size: number; // dynamically allocated fractional size
  side: 'BUY' | 'SELL';
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  executionPolicy: string; // From EXECUTION_SPEC.md (e.g., MAKER_ONLY)
  txSignature?: string; // Solana/Cryptographic ledger proof
}
```

### 3. Chronological Market Memory Collection (`market_snapshots`)
```typescript
interface MarketSnapshot {
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
```

---

## 5. Phased Execution Roadmap

*   **Phase 1 [IMMEDIATE]:** Implement the core types, EventBus, database structure updates, and swap simulation ticks with event-driven mechanics. Introduce `StrategyCompiler.ts`.
*   **Phase 2:** Implement `ExplainabilityEngine.ts` and the modular 7-Core Engine pipeline in `src/services/ai/`.
*   **Phase 3:** Introduce `PortfolioManager.ts` and `PositionSizer.ts` to control net portfolio delta, beta-adjusted risk, and fractional sizing.
*   **Phase 4:** Expand database capabilities to write chronological `market_snapshots` (Market Memory) and map them into the `Self-Optimization` pipeline.
*   **Phase 5:** Build out the Frontend to fully reflect portfolio exposure delta, active AI cores output status, explanation audit reports, and authentic state transitions.

---
*Authorized by the Staff Architecture Council.*
