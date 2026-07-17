# Risk Specification
## Project: Institutional Adaptive Quantitative Trading System (IAQTS)
**Version:** 1.0.0  
**Classification:** System-Wide Institutional Risk Policy

---

## 1. Systemic Mandate
Risk management is the absolute foundation of the IAQTS. No AI Engine, Compiler, or Strategy has the authority to bypass the parameters specified within this document. The Portfolio Manager enforces these rules programmatically before dispatching any order to the Execution Gateway.

---

## 2. Risk Boundaries & Threshold Metrics

The system enforces ten primary **Risk Boundaries** calculated on real-time portfolio metrics:

### A. Maximum Daily Loss (MDL)
*   **Threshold:** $1.5\%$ of Net Asset Value (NAV) per rolling 24-hour window.
*   **Rule:** If real-time unrealized loss + realized loss exceeds $1.5\%$, all active strategies are instantly terminated, resting orders cancelled, and the system locks out new strategies for the remainder of the trading day.

### B. Maximum Weekly Drawdown (MWDD)
*   **Threshold:** $4.0\%$ of NAV per rolling 7-day window.
*   **Rule:** System ceases execution, converts all open perpetual positions back to stablecoins (USDT/USDC), and enters static standby mode pending manual risk review.

### C. Maximum Monthly Drawdown (MMDD)
*   **Threshold:** $8.0\%$ of NAV.
*   **Rule:** Automatic hard shutdown of all system connections, revocation of active API keys, and notification of the operations risk committee.

### D. Maximum Systemic Exposure (MSE)
*   **Threshold:** $150\%$ of NAV across all compiled positions (Leveraged Limit).
*   **Rule:** Total combined contract value of active BTC + ETH + SOL positions must never exceed $1.5\times$ account balance.

### E. Maximum Asset Correlation
*   **Threshold:** $0.85$ Spearman correlation across the portfolio vector.
*   **Rule:** The Position Sizer will scale down positions in highly correlated assets (e.g., SOL and ADA) if their joint systemic exposure pushes the total portfolio beta above safety thresholds.

### F. Maximum Leverage
*   **Threshold:** $10.0\times$ on primary assets (BTC, ETH); $3.0\times$ on secondary assets (SOL, altcoins).
*   **Rule:** Strictly enforced leverage caps. Any attempt by an AI model to compile a strategy with higher leverage is rejected by the Risk Engine at the compilation step.

### G. Maximum Funding Rate Exposure (MFRE)
*   **Threshold:** Absolute funding rate $< 0.10\%$ per 8-hour epoch ($0.30\%$ daily) for carry/reversion strategies.
*   **Rule:** If the funding rate of an asset exceeds these limits, carry positions must be hedged, sized down, or unwound to prevent extreme cash-flow erosion.

### H. Maximum Overnight Risk
*   **Threshold:** Total margin exposure must be reduced by $30\%$ during defined illiquid overnight hours (22:00 to 02:00 UTC).
*   **Rule:** The Portfolio Manager issues a systemic de-risking event to reduce position sizes before the overnight boundary.

### I. Maximum News / Event Risk
*   **Threshold:** Pause all compilation 30 minutes before and after scheduled high-impact macroeconomic announcements (e.g., CPI, FOMC rate decisions).
*   **Rule:** System locks active grids in static state, broadens grid spacing parameters, or cancels close-spread maker orders to prevent flash crashes or high-slippage execution.

### J. Maximum Liquidation Probability (MLP)
*   **Threshold:** Calculated probability of liquidation over a 24-hour horizon must remain $< 0.01\%$.
*   **Rule:** Uses standard Monte Carlo models or Value-at-Risk (VaR) mapping:
    $$\text{Margin Distance} = \frac{\text{Mark Price} - \text{Liquidation Price}}{\text{Mark Price}}$$
    If $\text{Margin Distance} \le 3.0 \times \text{Daily Volatility}$, position size is immediately trimmed.

---

## 3. The Three-Line Defense Architecture

```
        +----------------------------------------+
        |                LINE 1:                 |
        |          Strategic AI Checks           |
        |  (Modular Risk AI audits strategy)     |
        +----------------------------------------+
                            |
                            v
        +----------------------------------------+
        |                LINE 2:                 |
        |           Portfolio Manager            |
        |  (Evaluates correlation & total beta)  |
        +----------------------------------------+
                            |
                            v
        +----------------------------------------+
        |                LINE 3:                 |
        |         Hard System Risk Engine        |
        |  (Database transactions & hard locks)  |
        +----------------------------------------+
```

1.  **Strategic AI Audit:** Risk AI assesses individual strategy risk profiles.
2.  **Portfolio Manager Audit:** Real-time mathematical checks on NAV, drawdown limits, asset correlations, and margin ratios.
3.  **Hard System Risk Gate:** Hard-coded code-level assertions within the Execution Gateway that throw errors or block order execution instantly if any metric is violated.

---
*Authorized by the Chief Risk Officer.*
