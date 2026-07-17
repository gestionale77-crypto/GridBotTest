# Quantitative Trading Specification (QTS)
## Project: Institutional Adaptive Quantitative Trading System (IAQTS)
**Version:** 1.0.0  
**Classification:** Proprietary Quantitative Engine Specification

---

## 1. Quantitative Framework Overview
The **Quantitative Trading Specification (QTS)** defines the mathematical, statistical, and algorithmic principles governing market analysis, strategy generation, and adaptive learning inside the IAQTS. 

Unlike retail grid systems, the IAQTS treats strategies as ephemeral configurations compiled dynamically based on classified microstructural conditions.

---

## 2. Market Regimes & Mathematical Classifications
The system relies on a **15-Regime Multi-Timeframe Structural Classifier** orchestrated by the AI core. Every observation epoch must categorize the targeted asset into exactly one of the following regimes, using statistical thresholds:

| Regime ID | Regime Name | Mathematical / Statistical Signature |
| :--- | :--- | :--- |
| `TREND_UP_LOW_VOL` | Upward Trend, Low Volatility | $ADX > 25$, $+DI > -DI$, $ATR_{14} < \text{EMA}(ATR_{14}, 50)$, skewness $\approx 0$ |
| `TREND_UP_HIGH_VOL` | Upward Trend, High Volatility | $ADX > 25$, $+DI > -DI$, $ATR_{14} \ge \text{EMA}(ATR_{14}, 50)$ |
| `TREND_UP_EXPANDING` | Upward Trend, Volatility Expanding | $ADX$ rising, Bollinger Band Width (BBW) accelerating upward, $+DI \gg -DI$ |
| `TREND_UP_EXHAUSTION` | Upward Trend, Overextended | RSI(14) $> 78$, price above Upper Bollinger Band, volume divergence (price rising, volume falling) |
| `TREND_DOWN_LOW_VOL` | Downward Trend, Low Volatility | $ADX > 25$, $-DI > +DI$, $ATR_{14} < \text{EMA}(ATR_{14}, 50)$ |
| `TREND_DOWN_HIGH_VOL`| Downward Trend, High Volatility | $ADX > 25$, $-DI > +DI$, $ATR_{14} \ge \text{EMA}(ATR_{14}, 50)$ |
| `MEAN_REVERSION` | Mean Reverting Range | $ADX < 18$, RSI(14) oscillating between $35$ and $65$, price within BBW bounds |
| `COMPRESSION` | Extreme Range Compression | BBW at historical 10th percentile, ADX $< 15$, ATR shrinking |
| `VOLATILITY_EXPANSION` | Volatility Expansion / Breakout | BBW widening rapidly, volume $> 2.5\times$ average, price breaking range highs/lows |
| `FAKE_BREAKOUT` | False Breakout | Price breaks range boundary but returns within $<3$ candles, high volume node rejection |
| `NEWS_MODE` | High Impact Event / Macro-Driven | Instantaneous spread widening, Bid/Ask volume drop, orderbook cancellation rate $> 80\%$ |
| `PANIC` | Systemic Liquidation Cascade | Net CVD deeply negative, funding rate collapsing, negative skewness, extreme ATR surge |
| `EUPHORIA` | Parabolic Blow-off Top | Net CVD deeply positive, high positive funding rate, extreme price expansion, parabolic shape |
| `LOW_LIQUIDITY` | Low Depth / Spreading | Spread $> 0.15\%$, total top-10 depth volume $< 25\%$ of historic median |
| `HIGH_LIQUIDITY` | Thick Orderbook / Aggregation | Spread $< 0.01\%$, total top-10 depth volume $> 175\%$ of historic median |

---

## 3. Modular Strategy Compilations
Strategies are constructed from scratch for every deployment epoch. The **Strategy Compiler** builds the following structural frameworks based on the active regime:

### A. Grid Strategy
*   **Application Regimes:** `MEAN_REVERSION`, `COMPRESSION`.
*   **Formulaic Placement:** Logarithmic or geometric spacing centering on SMA/EMA or Volume Weighted Average Price (VWAP).
*   **Elasticity Constraint:** Dynamic level cancel-replace if boundary is breached with confirmation.

### B. Dynamic Capital Accumulation (DCA)
*   **Application Regimes:** `TREND_UP_LOW_VOL`, `TREND_UP_EXPANDING`, `TREND_DOWN_HIGH_VOL` (hedged).
*   **Formulaic Placement:** Fibonacci level expansion intervals.

### C. Time Weighted Average Price (TWAP)
*   **Application Regimes:** `HIGH_LIQUIDITY`, `TREND_UP_LOW_VOL` (position build-up).
*   **Formulaic Placement:** Fixed time slices ($t$) executing fractional slice sizes ($q$) with randomized variance to mask order flow.

### D. Volume Weighted Average Price (VWAP)
*   **Application Regimes:** `HIGH_LIQUIDITY`, `TREND_DOWN_LOW_VOL` (order distribution).
*   **Formulaic Placement:** Real-time volume curve projection matching historical market distribution curves.

### E. Basis Trade
*   **Application Regimes:** `EUPHORIA` (Spot Long vs. Perp Short where funding rate is extremely high).
*   **Formulaic Placement:** Arbitrage execution balancing premium/discount spreads between spot and perpetual contracts.

### F. Carry Trade
*   **Application Regimes:** `MEAN_REVERSION` with high positive funding.
*   **Formulaic Placement:** Long spot asset paired with dynamic perpetual shorts, harvesting funding fees while continuously monitoring delta.

### G. Market Making (MM)
*   **Application Regimes:** `MEAN_REVERSION`, `COMPRESSION` (specifically when spread is profitable).
*   **Formulaic Placement:** Continuous bidirectional micro-sizing inside top-3 orderbook levels.

### H. Liquidity Provision (LP)
*   **Application Regimes:** `LOW_LIQUIDITY` (highly opportunistic, wider spreads).
*   **Formulaic Placement:** Dynamic hedging across price tiers to capture inventory skew premiums.

---

## 4. Layered Memory Architecture

```
+--------------------------------------------------------------+
|                    KNOWLEDGE MEMORY (AI)                     |
|  Maintains quantitative multi-factor patterns, performance  |
|  correlations, and model-weight hyperparameter calibrations. |
+--------------------------------------------------------------+
                              ^
                              |
+--------------------------------------------------------------+
|                     MARKET MEMORY (STATE)                    |
|  Captures high-frequency microstructural chronological snapshots |
|  (ATR, Spread, Funding, CVD, Orderbook Imbalances, etc).   |
+--------------------------------------------------------------+
                              ^
                              |
+--------------------------------------------------------------+
|                     TRADE MEMORY (EXECUTION)                 |
|  Tracks transaction logs (Entry/Exit, Latency, Slippage,     |
|  Fees, and Execution Quality metrics).                       |
+--------------------------------------------------------------+
```

### 1. Trade Memory (Execution Layer)
Stores structural metrics for every execution event:
*   `Id`, `Timestamp`, `Side`, `Price`, `Slippage` (Execution vs. Target), `LatencyMs` (Signal to Fill), `FeeUsdt`, `FillRatio` (Filled vs. Requested).

### 2. Market Memory (Microstructural Layer)
Captures granular chronological market snapshots:
*   `ATR`, `FundingRate`, `OpenInterest`, `Spread`, `LiquidityDepth`, `CVD`, `VolatilityCoefficent`.

### 3. Knowledge Memory (Cognitive Layer)
Generates derived semantic relationships over historical epochs:
*   **Synthesized Schema:** 
    ```json
    {
      "patternId": "KN_MR_083",
      "conditions": {
        "regime": "MEAN_REVERSION",
        "fundingRateRange": [0.0001, 0.0005],
        "atrState": "RISING",
        "orderbookImbalance": [0.65, 0.85]
      },
      "derivedRule": "Execute Asymmetrical Grid with logarithmic buy bias, levels=18, hedgeRatio=0.15",
      "historicalSuccessProbability": 0.812,
      "averageRoiPercent": 4.25
    }
    ```

---
*Authorized by the Staff Quantitative Council.*
