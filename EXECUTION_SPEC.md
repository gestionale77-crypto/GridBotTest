# Execution Specification
## Project: Institutional Adaptive Quantitative Trading System (IAQTS)
**Version:** 1.0.0  
**Classification:** Proprietary Execution Gateway Standard

---

## 1. Execution Philosophy
The IAQTS Execution Gateway rejects retail-grade market orders and blind price-hitting heuristics. Orders must be routed dynamically based on specific microstructural policies to minimize market impact, control slippage, protect inventory, and optimize capture of the maker fee rebate.

---

## 2. Microstructural Execution Policies

The engine enforces ten specific **Execution Policies** determined dynamically at strategy compilation time or based on real-time orderbook dynamics:

### A. Maker Only (Post-Only)
*   **Definition:** Orders are guaranteed to be placed as passive liquidity on the order book.
*   **Mechanism:** If an order would cross the current spread and execute as a taker, the Execution Gateway instantly rejects or cancels the order prior to transmission to the matching engine.
*   **Use Case:** High-volume grid levels to secure maker rebates ($0.02\%$ savings per turn).

### B. Aggressive (Taker / Immediate-Or-Cancel)
*   **Definition:** Priority is speed and instant execution over transaction cost.
*   **Mechanism:** Direct execution into existing resting liquidity. Uses `IOC` (Immediate-Or-Cancel) or `FOK` (Fill-Or-Kill) limit orders priced slightly inside the deep bid-ask book.
*   **Use Case:** Stop-loss triggers, panic liquidation hedging, and volatility breakouts.

### C. Passive (Limit Post)
*   **Definition:** Orders are posted deep within the orderbook queue to maximize entry quality.
*   **Mechanism:** Dynamically adjusted placement at support/resistance levels or deep orderbook liquidity blocks.
*   **Use Case:** Dynamic capital accumulation (DCA) and carry trades.

### D. Iceberg
*   **Definition:** Large orders are split into multiple hidden slices to mask massive size exposure.
*   **Mechanism:** Dispatches a single visible slice ($q_{vis}$). Once $q_{vis}$ is filled, the Execution Gateway automatically posts the next slice ($q_{next}$) until total quantity ($Q_{tot}$) is fully filled.
*   **Use Case:** Portfolio rebalancing involving sizes $>10\%$ of top-level book depth.

### E. Time Weighted Average Price (TWAP)
*   **Definition:** Distributes a larger order evenly across a specified time horizon ($T$).
*   **Mechanism:** Divides order into $n$ equal slices executed at intervals $t = T/n$. Introduces noise coefficient (random variation of $\pm15\%$ on size and timing) to prevent proprietary pattern detection.
*   **Use Case:** Large size spot positioning.

### F. Volume Weighted Average Price (VWAP)
*   **Definition:** Matches the execution rate with the historical volume distribution of the asset.
*   **Mechanism:** Adjusts slice sizing $q_i$ for time period $t_i$ to conform with the historical volume profile curve of that specific weekday/hour.
*   **Use Case:** Minimizing market impact in highly liquid regimes.

### G. Adaptive (Smart Routing)
*   **Definition:** Dynamically shifts execution speed based on the spread velocity.
*   **Mechanism:** If spread velocity rises, the execution transitions from passive limit posting to aggressive IOC sweeps. If liquidity returns, it reverts to maker-only.
*   **Use Case:** Grid trading in fluctuating volatility.

### H. Liquidity Seeking
*   **Definition:** Scans multiple book levels and hidden dark pools to find matching blocks.
*   **Mechanism:** Direct cross-referencing of orderbook curves to route orders specifically to levels exhibiting high rest-period density.
*   **Use Case:** Fast positioning without triggering directional alerts.

### I. Anti-Slippage Guard
*   **Definition:** Strict limit constraint on price degradation at execution time.
*   **Mechanism:** Compares expected execution price against actual average fill price. If calculated slippage exceeds $\text{MaxSlippageThreshold}$ (default: $0.05\%$), execution immediately pauses and routes to fallback routing.
*   **Use Case:** All execution.

### J. Anti-Sweep Protection
*   **Definition:** Protection against high-frequency trading (HFT) bots sweeping passive orders.
*   **Mechanism:** If volume acceleration on the taker side exceeds $300\%$ over a 100ms interval, passive orders are automatically pulled (cancelled) and re-queued $1.5\sigma$ further from the active spread.
*   **Use Case:** Passive grid levels in expanding volatility regimes.

---

## 3. Order Execution Lifecycle State Machine

```
      +-------------+
      |  Compiling  |
      +-------------+
             |
             v
      +-------------+
      |   Pending   |
      +-------------+
             |
             +-----------------------+
             |                       |
             v (Post-Only Fails)     v (Maker/Passive Posts)
      +-------------+         +-------------+
      |  Rejected   |         |   Resting   |
      +-------------+         +-------------+
                                     |
                                     +-----------------------+
                                     |                       |
                                     v (Fill Event)          v (Slippage/Sweep Pull)
                              +-------------+         +-------------+
                              |   Filled    |         |  Cancelled  |
                              +-------------+         +-------------+
```

1.  **Pending:** Strategy Compiler requests order generation. The Order Sizer computes exact size.
2.  **Resting:** Sent to the Gateway. Posted to exchange order book.
3.  **Filled:** Order matched. Event emitted to Portfolio Manager and DB updated.
4.  **Cancelled / Rejected:** Pulled due to risk limits, anti-sweep, or user manual intervention.

---
*Authorized by the Staff Engineering Council.*
