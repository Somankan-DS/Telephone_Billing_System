# TeleBill Pro — Billing Logic & Rating Mathematical Specification

## 1. Overview of the Rating Engine

The Billing Engine represents the computational core of TeleBill Pro. It is implemented as a deterministic, reusable service (`RatingService` and `BillingService`) leveraging **Decimal.js** for arbitrary-precision fixed-point arithmetic. 

By eliminating binary floating-point representations (IEEE-754 double precision), the engine guarantees identical financial outcomes for identical input records regardless of platform, CPU architecture, or execution order.

---

## 2. Mathematical Rating Formulation

### Step 1: Duration Quantization & Pulse Calculation
In commercial telecommunications, calls are billed in discrete units called **pulses** (e.g. 60-second standard pulses, or 1-second precision pulses for corporate accounts). 

For a call with duration $D$ seconds and configured plan pulse interval $P$ seconds:

$$\text{Pulse Count } (k) = \left\lceil \frac{\max(0, D)}{\max(1, P)} \right\rceil$$

$$\text{Billable Seconds } (B_s) = k \times P$$

$$\text{Billable Minutes } (B_m) = \frac{B_s}{60}$$

#### Pulse Boundary Behavior Examples ($P = 60\text{ seconds}$):
- Duration $D = 0\text{s} \implies k = 0, B_s = 0\text{s}, B_m = 0.0000$ (Zero charge).
- Duration $D = 25\text{s} \implies k = \lceil 25/60 \rceil = 1 \implies B_s = 60\text{s}, B_m = 1.0000$.
- Duration $D = 59\text{s} \implies k = \lceil 59/60 \rceil = 1 \implies B_s = 60\text{s}, B_m = 1.0000$.
- Duration $D = 60\text{s} \implies k = \lceil 60/60 \rceil = 1 \implies B_s = 60\text{s}, B_m = 1.0000$.
- Duration $D = 61\text{s} \implies k = \lceil 61/60 \rceil = 2 \implies B_s = 120\text{s}, B_m = 2.0000$.

---

### Step 2: Free Allowance Quota Deduction
If the subscriber has an active `FreeAllowanceBucket` with remaining minutes $A_{\text{rem}}$ for the matching call category (`LOCAL`, `STD`, or `ISD`):

1. **Full Allowance Coverage ($A_{\text{rem}} \ge B_m$):**
   $$\text{Free Minutes Deducted } (\Delta A) = B_m$$
   $$\text{New Remaining Allowance } (A'_{\text{rem}}) = A_{\text{rem}} - B_m$$
   $$\text{Charged Billable Minutes } (M_{\text{charged}}) = 0.0000$$

2. **Partial Allowance Coverage ($0 < A_{\text{rem}} < B_m$):**
   $$\text{Free Minutes Deducted } (\Delta A) = A_{\text{rem}}$$
   $$\text{New Remaining Allowance } (A'_{\text{rem}}) = 0.0000$$
   $$\text{Charged Billable Minutes } (M_{\text{charged}}) = B_m - A_{\text{rem}}$$

3. **Zero Allowance Remaining ($A_{\text{rem}} \le 0$):**
   $$\text{Free Minutes Deducted } (\Delta A) = 0.0000$$
   $$\text{New Remaining Allowance } (A'_{\text{rem}}) = 0.0000$$
   $$\text{Charged Billable Minutes } (M_{\text{charged}}) = B_m$$

---

### Step 3: Monetary Rate Assessment
Given unit rate $R$ per minute for the call destination tier (`rateLocal`, `rateStd`, or `rateIsd`):

$$\text{Rated Amount } (\text{Cost}) = \text{round}_4(M_{\text{charged}} \times R)$$

Non-completed calls (`status` in `['BUSY', 'NO_ANSWER', 'FAILED']`) or zero-duration calls strictly evaluate to $\text{Cost} = 0.0000\text{ INR}$ with zero pulse counts and zero allowance deductions.

---

## 3. Prepaid Real-Time Balance Enforcement

For subscribers assigned to a `PREPAID` tariff plan, the system enforces real-time balance checks at CDR ingestion time:

1. System resolves subscriber active wallet balance $W$.
2. If $\text{Cost} > 0$ and $W < \text{Cost}$:
   The engine rejects the transaction with `ValidationError("Insufficient prepaid balance for call duration", "INSUFFICIENT_PREPAID_BALANCE")` returning HTTP 400.
3. If $W \ge \text{Cost}$:
   The engine deducts the charge atomically:
   $$W_{\text{new}} = W - \text{Cost}$$
   $$\text{customer.prepaidBalance} \leftarrow \text{round}_2(W_{\text{new}})$$

---

## 4. Postpaid Monthly Billing Cycle & Tax Calculation

When a monthly billing cycle run is initiated (e.g., code `2026-11`):

### Step 1: Fixed Monthly Rental
For active postpaid subscribers, base rental $R_{\text{fixed}}$ is assessed from `plan.monthlyRental` (or prorated base charge override if provided):
$$\text{Rental} = R_{\text{fixed}}$$

### Step 2: Aggregation of Unbilled Rated CDRs
All unbilled CDRs (`isBilled = false`) belonging to the subscriber are retrieved. Total call usage charge $U$ is aggregated:
$$U = \sum_{i=1}^{n} \text{cdr}_i.\text{ratedAmount}$$

### Step 3: Taxable Subtotal Calculation
$$\text{Taxable Subtotal } (S) = \max(0, \text{Rental} + U - \text{Discounts})$$

### Step 4: Statutory GST Assessment (18.00%)
In compliance with Indian statutory telecommunications tax codes, an 18% Goods and Services Tax (GST) is applied with half-up rounding:
$$\text{GST Amount } (T) = \text{round}_2(S \times 0.18)$$

### Step 5: Arrears Debt Rollover (Tax Isolated)
The engine queries all previous invoices for the subscriber with unsettled balances (`status` in `['UNPAID', 'PARTIALLY_PAID', 'OVERDUE']`). The unpaid balance is summed:
$$\text{Arrears } (A_{\text{prev}}) = \sum (\text{previousInvoice.totalAmount} - \text{previousInvoice.paidAmount})$$

> **Critical Tax Isolation Guarantee:** $A_{\text{prev}}$ was already subjected to 18% GST during its original cycle of issuance. TeleBill Pro strictly isolates $A_{\text{prev}}$ and adds it directly to the total due without applying tax, preventing compound illegal double taxation.

### Step 6: Total Invoice Due
$$\text{Total Invoice Amount } (I_{\text{total}}) = \text{round}_2(S + T + A_{\text{prev}})$$

$$\text{status} = \begin{cases} \text{'PAID'}, & \text{if } I_{\text{total}} = 0 \\ \text{'UNPAID'}, & \text{if } I_{\text{total}} > 0 \end{cases}$$

All included CDRs are flagged `isBilled = true`, linked to the generated `invoiceId`, and recorded in an atomic database transaction.

---

## 5. Hybrid Predictive Bill Algorithm (HWMA)

To eliminate subscriber "bill shock" mid-cycle, TeleBill Pro integrates a real-time predictive algorithm (`/api/customers/:id/bill-prediction`):

### Mathematical Model
Let:
- $D_{\text{elapsed}}$: Days elapsed in current 30-day billing cycle ($1 \le D_{\text{elapsed}} \le 30$).
- $U_{\text{current}}$: Cumulative unbilled call usage charges incurred so far in current cycle.
- $R_{\text{fixed}}$: Fixed monthly plan rental.
- $H$: Historical Weighted Moving Average (HWMA) of previous 3 completed invoice totals:
  $$H = 0.5 \times I_{t-1} + 0.3 \times I_{t-2} + 0.2 \times I_{t-3}$$
- $\alpha$: Dynamic confidence weighting factor shifting over time:
  $$\alpha = \frac{D_{\text{elapsed}}}{30}$$

### 1. Daily Run-Rate Projection
The current cycle unbilled usage is normalized to a daily burn rate and extrapolated to a 30-day month:
$$\text{Projected Usage } (\hat{U}) = \left(\frac{U_{\text{current}}}{D_{\text{elapsed}}}\right) \times 30$$
$$\text{Run-Rate Estimate } (\hat{E}_{\text{run}}) = R_{\text{fixed}} + \hat{U}$$

### 2. Hybrid Forecast Combination
The predicted subtotal $\hat{S}$ blends current empirical usage with historical baseline habits:
$$\hat{S} = \begin{cases} \alpha \times \hat{E}_{\text{run}} + (1 - \alpha) \times H, & \text{if historical data exists} \\ \hat{E}_{\text{run}}, & \text{if cold start (no history)} \end{cases}$$

### 3. Final Projected Total (With 18% GST)
$$\hat{T}_{\text{final}} = \text{round}_2(\hat{S} \times 1.18)$$

### Confidence Score Formulation
$$\text{Confidence} = \text{round}_2\left(0.50 + 0.45 \times \left(\frac{D_{\text{elapsed}}}{30}\right)\right)$$
- On Day 1: Confidence is 51% (wide projection cone).
- On Day 15: Confidence is 73% (moderate certainty).
- On Day 30: Confidence is 95% (near absolute determinism).
