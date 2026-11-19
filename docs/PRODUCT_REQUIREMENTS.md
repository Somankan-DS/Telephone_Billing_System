# TeleBill Pro — Product Requirements Document (PRD)

## 1. System Overview & Scope

TeleBill Pro is designed around 10 cohesive business domains comprising 48 core functional requirements (F1–F48) and rigorous enterprise-grade non-functional criteria.

---

## 2. Functional Requirements Matrix (F1 – F48)

### Domain 1: Authentication & Role-Based Access Control
- **F1: Secure Credential Authentication:** Users authenticate via email/phone identifier and password against `/api/auth/login`. System verifies Bcrypt hash with cost factor 12.
- **F2: Ephemeral JWT Token Issuance:** Upon successful authentication, server issues HS256-signed JWT token containing user UUID, email, role, and customerId with strict 60-minute expiration.
- **F3: 3-Tier Role-Based Route Guards:** Perimeter middleware enforces access policies: `ADMIN` (universal operational access), `STAFF` (CRM, tariff, CDR, and billing execution), and `CUSTOMER` (strict self-service profile and invoice access).
- **F4: Zero-Trust IDOR Protection:** Customer requests cannot access or alter resources belonging to other subscribers. Profile queries and modifications are bound to JWT session identity.
- **F5: Self-Service Credential Rotation:** Authenticated users can update passwords via `/api/auth/password` requiring verification of the active password, rejection of reuse, and validation against 8+ character complexity rules (uppercase, lowercase, number, symbol).

### Domain 2: Executive Dashboard & Live Operational KPIs
- **F6: Dynamic Customer Counts:** Live query calculating total registered subscribers and active accounts directly from `customers` table without hardcoded approximations.
- **F7: Realized Revenue Calculation:** Aggregation of all settled payments (`status = 'SUCCESS'`) across the platform ledger.
- **F8: Cumulative Billed Metrics:** Real-time summation of `totalAmount` across all generated invoices.
- **F9: Outstanding Arrears Tracking:** Live tracking of delinquent and unpaid receivables (`totalAmount - paidAmount`).
- **F10: Traffic Distribution Analytics:** Volume breakdown of telephone call events categorized into `LOCAL`, `STD`, and `ISD` segments.

### Domain 3: Customer Management (CRM 360)
- **F11: Automated Account Provisioning:** Automatic generation of standard telecom subscriber identifiers formatted as `TEL-YYYYMM-XXXXX`.
- **F12: Customer Onboarding Pipeline:** Creation of customer profiles linked to user credentials with name, email, phone (MSISDN), address, and initial credit/prepaid wallet balance.
- **F13: Unique Constraint Verification:** Absolute enforcement of uniqueness for customer email and MSISDN phone numbers, rejecting duplicates with HTTP 409 Conflict.
- **F14: Lifecycle State Machine Transitions:** Formal state management supporting `ACTIVE`, `SUSPENDED`, and `INACTIVE` states. Disallow direct transition from `INACTIVE` to `SUSPENDED`.
- **F15: Tariff Plan Assignment:** Dynamic association of tariff plans to customer accounts with initialization of quota allowance buckets.
- **F16: Unified 360° Profile Retrieval:** Single aggregated endpoint returning customer demographics, wallet balance, active plan, allowance quotas, recent call logs, and billing history.

### Domain 4: Tariff Plans & Rating Configuration
- **F17: Multi-Type Plan Support:** Configuration of both Postpaid monthly cycles and Prepaid talktime/voucher plans.
- **F18: Pulse Increment Definition:** Support for configurable pulse duration ratings, notably 60-second standard pulse and 1-second enterprise precision pulse rating.
- **F19: Multi-Tier Unit Rates:** Independent configuration of Local, STD National, and ISD International rates formatted to 4 decimal places (`DECIMAL(10,4)`).
- **F20: Free Allowance Bundles:** Definition of bundled inclusive minutes per plan (`includedLocalMinutes`, `includedStdMinutes`, `includedIsdMinutes`).
- **F21: Tariff Code Uniqueness:** Enforcement of unique `planCode` strings (e.g. `POST-STD-299`, `PRE-VAL-199`) and input validation forbidding negative rentals or non-positive pulse intervals.

### Domain 5: Call Detail Records (CDR) & Traffic Simulation
- **F22: Single CDR Ingestion:** Processing individual call events with caller MSISDN, receiver MSISDN, call type, start/end timestamps, and duration in seconds.
- **F23: Cryptographic Deduplication (SHA-256):** Calculation of deterministic hash `SHA256(caller:receiver:isoTimestamp:duration)`. Identical records are idempotently recognized without duplicate rating.
- **F24: Inverted Timestamp Validation:** Strict rejection of records where `endTime < startTime` with HTTP 400 Validation Error.
- **F25: Bulk Streaming CSV Import:** High-throughput streaming CSV parser accepting standard telecom mediation CDR files with batch deduplication.
- **F26: Poisson Traffic Simulator:** Integrated simulation engine generating synthetic calls following Poisson arrival processes and log-normal duration distributions.

### Domain 6: Deterministic Billing & Invoicing Engine
- **F27: Monthly Postpaid Billing Cycle Execution:** Automated aggregation of all unbilled rated CDRs for a customer over a specified billing cycle code (e.g. `2026-11`).
- **F28: Fixed-Point Rating Engine:** Rating calculation adhering to `ceil(duration / pulse) * pulse` with zero floating-point drift, deducting free allowance minutes before assessing monetary charges.
- **F29: Statutory GST Tax Calculation:** Deterministic assessment of 18% Goods and Services Tax applied strictly to taxable subtotal (Rental + Usage - Discounts).
- **F30: Arrears Debt Rollover (Tax Isolated):** Carryover of previous unpaid balances into new invoice totals without applying secondary compound taxation.
- **F31: Atomic Line Item Ledger:** Generation of itemized invoice lines categorized into `RENTAL`, `USAGE`, `TAX`, and `ARREARS`.
- **F32: Vector PDF Invoice Generation:** Server-side compilation of downloadable vector PDF documents with company tax metadata, itemized tables, and payment stubs.

### Domain 7: Payment Gateway Simulation & Settlement
- **F33: Idempotent Payment Simulation:** Simulated settlement endpoint accepting UPI, Credit Card, and Net Banking with `idempotencyKey` protection preventing replay attacks.
- **F34: Atomic Invoice Settlement:** Updating invoice payment ledger; transitioning invoice state from `UNPAID` to `PARTIALLY_PAID` or `PAID`.
- **F35: Automatic Wallet Credit on Overpayment:** Excess payment above the outstanding invoice balance is automatically credited to the customer's prepaid wallet balance.
- **F36: Direct Prepaid Recharge:** Independent wallet top-up processing for prepaid subscribers enabling service continuation.

### Domain 8: Financial Reporting & Aging Analysis
- **F37: Accounts Receivable Aging Buckets:** Partitioning of outstanding debt into standard corporate aging brackets: 0–30 Days (Current), 31–60 Days, 61–90 Days, and 90+ Days (Critical).
- **F38: Monthly Revenue Trajectory:** Time-series query returning billed revenue vs collected payments over historical monthly windows.
- **F39: Customer Acquisition Trend:** Time-series reporting of cumulative and new customer registrations per month.
- **F40: Historical Date Range Filtering:** Sanitized date range filtering rejecting inverted date intervals (`startDate > endDate`) with HTTP 400.
- **F41: Operational Zero-Data Safety:** Reports execute cleanly without exceptions over empty historical ranges, returning empty datasets and zero counts.

### Domain 9: In-App Notifications & Automated Dunning
- **F42: Automated Bill Due Reminders:** Automated alert dispatch for invoices nearing due dates (within 5 days).
- **F43: Overdue Delinquency Notifications:** Automatic dispatch of urgent dunning notices when due dates elapse without full payment.
- **F44: 24-Hour Deduplication Safeguard:** Notification engine prevents alert spam by suppressing identical alert types sent to the same subscriber within a 24-hour window.

### Domain 10: Predictive Billing Engine & Analytics
- **F45: Hybrid Bill Prediction Algorithm:** Dynamic intra-cycle projection combining Daily Run-Rate extrapolation:
  $$\text{Run-Rate} = \text{Fixed Rental} + \left(\frac{\text{Unbilled Usage}}{\text{Elapsed Days}} \times 30\right)$$
  with 3-month Historical Weighted Moving Average (HWMA: weights 0.5, 0.3, 0.2).
- **F46: Self-Adjusting Alpha Weighting:** Dynamic weighting parameter $\alpha = \frac{\text{Elapsed Days}}{30}$ shifting trust from historical trends on Day 1 ($\alpha = 0.03$) to empirical reality on Day 30 ($\alpha = 1.00$).
- **F47: Natural Language Explainability Narrative:** Plain-English contextual explanation accompanying numeric predictions to eliminate subscriber bill shock.
- **F48: 24-Hour Calling Heatmap Analytics:** Matrix aggregation tracking calling frequency across hours of the day (0:00 to 23:00) to identify peak usage windows.

---

## 3. Non-Functional Requirements (NFRs)

| ID | Requirement Area | Standard / Metric |
| :--- | :--- | :--- |
| **NFR-SEC-01** | Password Security | Bcrypt hashing strictly configured to Cost Factor 12 (~300ms computational proof-of-work per hash). |
| **NFR-SEC-02** | Token Expiration | JWT access tokens expire after exactly 60 minutes; no infinite-lived bearer tokens. |
| **NFR-SEC-03** | Injection Mitigation | All database queries executed through Prisma parameterized query builder; zero raw string interpolation. |
| **NFR-MATH-01** | Decimal Integrity | No IEEE-754 binary floating-point representations used for monetary values. Fixed precision `DECIMAL(10,4)` for rates and `DECIMAL(10,2)` for currency. |
| **NFR-MATH-02** | Rounding Standard | Statutory half-up rounding (`ROUND_HALF_UP`) for currency and ceiling rounding (`Math.ceil`) for telecom call pulses. |
| **NFR-REL-01** | Database Concurrency | SQLite WAL mode enabled with 5000ms busy timeout allowing simultaneous readers during active write operations. |
| **NFR-REL-02** | Idempotency | Payment submissions and billing runs are strictly idempotent via unique constraints. |
| **NFR-PERF-01** | API Response Latency | P95 latency for core CRUD and rating operations under 50ms (excluding deliberate Bcrypt hashing). |
