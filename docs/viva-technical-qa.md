# TeleBill Pro — Academic Viva Voce & Technical Defense Q&A

**Project Title:** TeleBill Pro — Smart Telephone Billing & Telecom Management Platform  
**Academic Context:** Innovative Project-I, CSE (Data Science), University of Engineering & Management (UEM), Kolkata  
**Author / Engineering Team:** Department of Computer Science & Engineering  
**Scope:** Carrier-Grade BSS Architecture, Mathematical Formulations, Concurrency, Cryptography, and Statutory Rating  

---

## Guide for the Student / Presenter

During your technical viva examination, the evaluators and professors will test your understanding of:
1. **Core Computer Science Foundations:** Floating-point arithmetic, concurrency models, cryptographic hashing, time complexity, and data structures.
2. **Telecom Domain Knowledge:** Call Detail Records (CDRs), rating engines, pulse increments, prepaid real-time charging, postpaid cycles, and OSS/BSS boundaries.
3. **Software Engineering & Security:** ACID transactions, WAL mode, anti-IDOR perimeters, password hashing, and test pyramid methodologies.
4. **Data Science & Analytics:** Predictive time-series modeling (HWMA), Poisson call arrival distributions, and explainable AI metrics.

Below are **26 high-yield technical viva questions** with in-depth, rigorous engineering answers directly mapped to the TeleBill Pro codebase.

---

## Category 1: Telecom Rating, Pulse Mechanics & Fixed-Point Mathematics

### Q1. Why did you not use standard JavaScript `Number` for financial calculations, and what is IEEE-754 binary floating-point drift?
**Answer:**
Standard JavaScript numbers are 64-bit double-precision binary floating-point numbers conforming to the **IEEE-754 standard**. In binary floating-point arithmetic, fractions whose denominators cannot be expressed as powers of two cannot be stored with exact finite binary fractions. For example:
$$0.1_{10} = 0.00011001100110011..._2 \quad (\text{infinite repeating binary})$$
In native JavaScript, evaluating `0.1 + 0.2` results in `0.30000000000000004`.

In a carrier-grade telecom billing system rating millions of call pulses, fractional rounding drift results in severe financial leakage, balance discrepancies, and audit failures:
- Fractional pulse rates (e.g., $\text{INR } 1.00 / 60\text{ sec} = \text{INR } 0.01666.../\text{sec}$) would accumulate compound rounding errors.
- Statutory 18% GST calculations would drift from accounting ledgers.
- Invoices would retain micro-fractional unpaid balances (e.g., $\text{INR } 0.0000001$), preventing them from ever achieving `PAID` status.

To eliminate this entirely, TeleBill Pro mandates arbitrary-precision base-10 decimal arithmetic using the **`decimal.js`** library across all rating, tax, ledger, and payment services, guaranteeing **0.00000000% mathematical drift**.

---

### Q2. How does the Telecom Pulse Rating Engine work, and how are partial minutes handled?
**Answer:**
Telecom operators rate calls based on discrete charging intervals called **pulses**. A pulse can be configured as 60 seconds (per-minute billing), 30 seconds (half-minute billing), or 1 second (per-second billing).

In TeleBill Pro (`src/modules/cdr/cdr.service.ts`):
1. The engine checks if the call status is `COMPLETED`. Calls that are `FAILED`, `BUSY`, or `NO_ANSWER` have their billable seconds set to $0$ and are rated at $\text{INR } 0.00$.
2. For completed calls, the billable seconds are quantized into whole pulses using the ceiling function:
   $$\text{Pulse Count} = \left\lceil \frac{\text{Billable Seconds}}{\text{Pulse Size}} \right\rceil$$
3. For example, under a 60-second pulse:
   - A 5-second call requires $\lceil 5 / 60 \rceil = 1\text{ pulse}$ (billed for a full 60 seconds).
   - A 61-second call requires $\lceil 61 / 60 \rceil = 2\text{ pulses}$ (billed for 120 seconds).
4. The pulse rate is computed from the tariff plan's base rate:
   $$\text{Pulse Rate} = \frac{\text{Tariff Rate per Minute} \times \text{Pulse Size}}{60}$$
5. The raw call charge is then:
   $$\text{Charge} = \text{Pulse Count} \times \text{Pulse Rate}$$
   rounded to 2 decimal places using `ROUND_HALF_UP`.

---

### Q3. How do Free Allowance Buckets interact with call rating?
**Answer:**
TeleBill Pro supports bundled allowances (e.g., 300 free local minutes) managed through the `FreeAllowanceBucket` entity:
1. When a CDR arrives, the engine queries the active allowance bucket for the subscriber's account.
2. If `remaining_units > 0`, the engine deducts the call duration from the bucket:
   - If the call is 15 minutes and the bucket has 20 minutes remaining:
     $$\text{Remaining Bucket} = 20 - 15 = 5\text{ minutes}$$
     $$\text{Billed Call Cost} = \text{INR } 0.00$$
   - If the call is 25 minutes and the bucket has only 10 minutes remaining:
     $$\text{Covered by Allowance} = 10\text{ minutes}$$
     $$\text{Overage Duration} = 15\text{ minutes}$$
     $$\text{Billed Call Cost} = \text{Rate}(\text{Overage Duration})$$
3. In prepaid accounts, when allowances reach zero, the engine shifts dynamically to balance deduction.

---

### Q4. Explain the difference between Real-Time Charging (Prepaid) and Offline Batch Rating (Postpaid).
**Answer:**
- **Prepaid (Online/Real-Time Charging):**
  - Rating must occur at CDR ingestion time.
  - The rating engine checks the customer's `balance`. If the balance is insufficient to cover the estimated call cost, the call is rejected or barred (HTTP 400).
  - If sufficient, the calculated charge is atomically deducted from the customer's prepaid balance (`balance = balance - charge`) within a database transaction at the instant the CDR is processed.
- **Postpaid (Offline / Batch Rating):**
  - CDRs are ingested continuously and rated against the active tariff plan.
  - The calculated charges are recorded with `is_billed = false`.
  - At the close of the billing cycle (e.g., month-end), a batch billing service aggregates all unbilled CDRs into an itemized `Invoice`, applies monthly rental charges, evaluates taxes, rolls over past arrears, and marks the CDRs as `is_billed = true`.

---

## Category 2: Data Integrity, Concurrency & SQLite Engineering

### Q5. Why did you choose SQLite with WAL mode over an external MySQL or PostgreSQL database server?
**Answer:**
We made this engineering decision following **ADR-003**:
1. **Zero External Daemon Dependencies:** Setting up an external MySQL/PostgreSQL server requires host-level daemons, user permissions, networking setup, and socket management, creating reproducibility friction for academic evaluation.
2. **Embedded ACID Compliance:** SQLite is an in-process, ACID-compliant SQL engine that operates directly against a single local file, offering zero network IPC latency ($<0.05\text{ ms}$ query round-trips).
3. **Concurrency via WAL Mode:** Standard SQLite locks the entire database file during writes. By executing:
   ```sql
   PRAGMA journal_mode = WAL;
   PRAGMA busy_timeout = 5000;
   PRAGMA synchronous = NORMAL;
   ```
   SQLite transitions to **Write-Ahead Logging**. In WAL mode, writes are appended to an auxiliary `-wal` file while reads execute concurrently against the database snapshot. **Readers never block writers, and writers never block readers.**
4. **Stress Verification:** Under our test suite (`adversarial_db_wal_stress.test.ts`), 50 concurrent async workers executing continuous CDR writes and aggregate queries operated with a 100% success rate and zero lock contention.

---

### Q6. How does TeleBill Pro prevent duplicate CDR ingestion, and why did you use SHA-256 instead of auto-increment IDs?
**Answer:**
In telecommunications, network switches often re-transmit CDR packets due to network retries, connection drops, or buffer flushes. If a system relies solely on auto-incrementing IDs, every re-transmitted CDR creates a new database row, causing catastrophic double-billing.

TeleBill Pro enforces **Cryptographic Idempotent Deduplication** (ADR-004):
1. A canonical string is assembled from the immutable attributes of the call:
   $$\text{Payload} = \text{customer\_id} \mid \text{caller} \mid \text{receiver} \mid \text{start\_time\_ISO} \mid \text{duration}$$
2. A deterministic **SHA-256 hash** (64 hex characters) is computed:
   $$\text{call\_hash} = \text{SHA256}(\text{Payload})$$
3. The database table `CallDetailRecord` defines a `UNIQUE INDEX` on `call_hash`.
4. If a duplicate CDR arrives:
   - The query detects `call_hash` collision.
   - The engine safely discards the packet, logs an audit entry, and returns `{ is_duplicate: true, cdr_id: existing.id }`.
   - The subscriber's balance or unbilled usage is **never** debited a second time.

---

### Q7. How are database transactions utilized during the monthly postpaid billing run?
**Answer:**
Monthly billing generation is a high-stakes financial mutation involving multiple tables. TeleBill Pro wraps the entire sequence in an atomic transaction (`prisma.$transaction`):
1. **Query Unbilled CDRs:** Retrieve all records for the subscriber where `is_billed = false` within the billing period.
2. **Calculate Usage Subtotal:** Sum call charges using `decimal.js`.
3. **Query Delinquent Arrears:** Inspect unpaid past invoices (`status IN ('ISSUED', 'OVERDUE')`).
4. **Compute Statutory Tax:** Calculate 18% GST solely on the current cycle's subtotal (rental + usage).
5. **Create Invoice & Items:** Insert the `Invoice` header and all itemized `InvoiceItem` rows (rental, call usage, tax, arrears).
6. **Mark CDRs as Billed:** Execute `UPDATE CallDetailRecord SET is_billed = true WHERE id IN (...)`.
7. **Create Audit Log & Notification:** Insert audit trail and customer notification.

If any query fails or the server crashes mid-execution, the entire transaction automatically **rolls back**. No partial invoices or prematurely billed CDRs are ever orphaned.

---

## Category 3: Statutory Taxation & Accounting Mechanics

### Q8. What is Statutory Tax Isolation, and why is it critical in telecom arrears management?
**Answer:**
Under Indian and international tax law (including the GST framework), tax is levied on the provision of services in the period the service was rendered.

When a customer fails to pay a previous invoice (e.g., Invoice 101 for $\text{INR } 352.82$, which already included $18\%$ GST):
- The delinquent balance ($\text{INR } 352.82$) is rolled over into the new invoice (Invoice 102) as **Arrears**.
- If a billing engine naively calculates tax on the invoice grand total:
  $$\text{Tax} = 0.18 \times (\text{Current Subtotal} + \text{Arrears}) \quad \leftarrow \mathbf{ILLEGAL!}$$
  the customer would be taxed a second time on the already-taxed past arrears. This is illegal compound double taxation.

**TeleBill Pro Formula:**
$$\text{Taxable Amount} = \text{Base Rental} + \text{Current Cycle Call Usage Charges}$$
$$\text{Statutory GST } (18\%) = \text{Taxable Amount} \times 0.18$$
$$\text{Total Invoice Amount} = \text{Taxable Amount} + \text{Statutory GST} + \mathbf{Exempt\ Arrears}$$
Arrears are added strictly *after* the tax calculation, ensuring absolute statutory compliance.

---

### Q9. How does the system handle overpayments and partial payments?
**Answer:**
In commercial billing systems, customers sometimes pay more or less than the invoice total:
- **Partial Payment:** When a customer pays $\text{INR } 200$ against a $\text{INR } 352.82$ invoice:
  - A `Payment` record of $\text{INR } 200$ is inserted.
  - The invoice's `paid_amount` increments to $\text{INR } 200$.
  - The invoice status transitions to `PARTIALLY_PAID`.
  - The remaining $\text{INR } 152.82$ remains due and will roll over as arrears if unpaid at cycle close.
- **Overpayment (Wallet Credit):** When a payment is made that exceeds the remaining balance or on an already settled invoice:
  - TeleBill Pro does not reject the transaction.
  - It records the payment, marks the invoice `PAID`, and automatically deposits the surplus into the customer's **prepaid wallet balance** (`balance = balance + surplus`).

---

## Category 4: Security, Authentication & Anti-IDOR Perimeters

### Q10. What is an IDOR (Insecure Direct Object Reference) vulnerability, and how does TeleBill Pro prevent it?
**Answer:**
**IDOR** (also known as Broken Object Level Authorization, OWASP API1:2023) occurs when an application receives a user-supplied identifier (e.g., `/api/invoices/inv_abc123` or `/api/customers/cust_999`) and retrieves the record without validating whether the authenticated user owns that resource. An attacker could simply increment IDs to view confidential phone calls and invoices of other subscribers.

**TeleBill Pro Anti-IDOR Defense:**
1. Authentication middleware decodes the JWT and attaches `req.user` (`{ id, role, customerId }`).
2. Role-Based Access Control (RBAC):
   - Users with role `ADMIN` or `OPERATOR` have system-wide access to all records.
   - Users with role `CUSTOMER` are restricted by an explicit security perimeter.
3. In every controller accessing customer-specific data (CDRs, invoices, notifications, profiles):
   ```typescript
   if (req.user.role === 'CUSTOMER') {
     if (req.user.customerId !== requestedCustomerId) {
       throw new ForbiddenError('Access Denied: You cannot view resources belonging to another subscriber.');
     }
   }
   ```
4. Even if a customer inspects browser network traffic and attempts to request another customer's invoice PDF or CDR log, the server immediately rejects the request with HTTP `403 Forbidden`.

---

### Q11. Why did you use Bcrypt with Cost Factor 12, and how do you protect against password timing attacks?
**Answer:**
1. **Bcrypt with Work Factor 12:**
   - Standard MD5 or SHA-256 hashes are designed for high throughput (billions of hashes per second), making them vulnerable to GPU-accelerated brute-force attacks.
   - `bcrypt` is an adaptive key-derivation function based on the Blowfish cipher that incorporates cryptographic salting and configurable iterations ($2^{\text{cost}}$).
   - A cost factor of 12 requires 4,096 iterations, taking $\approx 250\text{--}300\text{ ms}$ on modern CPUs. This makes offline dictionary and rainbow-table attacks computationally prohibitive.
2. **Timing Attack Protection:**
   - If an attacker tries passwords for various usernames, measuring the response time could reveal whether the username exists (e.g., non-existent user returns in $2\text{ ms}$, existing user returns in $280\text{ ms}$).
   - In `auth.service.ts`, when a queried username is not found, the service executes a dummy bcrypt comparison against a pre-computed hash before returning `401 Unauthorized`. This ensures constant execution time regardless of username validity.

---

### Q12. Explain the JWT Token lifecycle and why stateless tokens were chosen.
**Answer:**
- **Token Signing:** Tokens are signed using **HMAC-SHA256 (HS256)** using a 256-bit secret key.
- **Payload:** Contains user ID, username, assigned role (`ADMIN`, `OPERATOR`, `CUSTOMER`), and linked `customerId`.
- **Expiration Window:** Hardcoded to 60 minutes (`expiresIn: '1h'`). Short lifespans minimize exposure if a token is intercepted.
- **Stateless Architecture:** The server does not store active session records in a database or Redis cache. Every incoming request validates the cryptographic signature mathematically. This enables zero-latency validation, instant horizontal server scaling, and uninterrupted development reboots.

---

## Category 5: Predictive Modeling & Data Science

### Q13. Explain the mathematics of the Hybrid Holt-Winters Moving Average (HWMA) Predictive Billing Engine.
**Answer:**
TeleBill Pro includes an intra-cycle predictive billing algorithm in `src/modules/prediction/prediction.service.ts` to solve subscriber "bill shock".

The model uses a **Hybrid Holt-Winters Moving Average** combining historical cycle baselines with current intra-cycle velocity:

1. **Intra-Cycle Burn Rate (Velocity):**
   $$V_{\text{MTD}} = \frac{\text{Month-to-Date Accrued Usage Charges}}{\text{Days Elapsed in Current Cycle}}$$
2. **Projected Remaining Call Charges:**
   $$\text{Days Remaining} = \text{Total Cycle Days} - \text{Days Elapsed}$$
   $$\text{Projected Remaining Usage} = V_{\text{MTD}} \times \text{Days Remaining}$$
3. **Holt-Winters Exponential Smoothing on Past Invoices:**
   Given past cycle totals $I_1, I_2, \dots, I_k$:
   $$S_t = \alpha I_t + (1 - \alpha)(S_{t-1} + b_{t-1})$$
   $$b_t = \beta(S_t - S_{t-1}) + (1 - \beta)b_{t-1}$$
   where $\alpha = 0.6$ (weight on recent cycle) and $\beta = 0.2$ (trend velocity).
4. **Blended Forecast:**
   $$\text{Predicted Usage} = w_1(\text{Projected Remaining}) + w_2(S_t)$$
   $$\text{Forecasted Subtotal} = \text{Base Plan Rental} + \text{MTD Usage} + \text{Predicted Usage}$$
   $$\text{Predicted Total Bill} = (\text{Forecasted Subtotal} \times 1.18) + \text{Delinquent Arrears}$$

---

### Q14. Why is the prediction model "Explainable AI" rather than a Black-Box Neural Network?
**Answer:**
In financial billing and telecommunications:
1. **Regulatory Auditing:** If a subscriber questions why an automated alert warned them of an impending $\text{INR } 850$ bill, a deep neural network (such as an LSTM) cannot explain the individual weights.
2. **Interpretability:** TeleBill Pro's prediction response decomposes the forecast into human-understandable components:
   - Fixed Monthly Base Rental
   - Billed Month-to-Date Call Usage
   - Estimated Remaining Usage (with daily burn rate in INR/day)
   - Projected 18% Statutory GST
   - Existing Overdue Arrears
3. **Confidence Scoring:** The model calculates a variance score ($0.0\text{--}1.0$) based on call frequency consistency, allowing the UI to state whether the prediction has *High*, *Medium*, or *Low* confidence.

---

### Q15. How does the Poisson Call Traffic Simulator work?
**Answer:**
In telecommunications traffic engineering (originating from A.K. Erlang's queueing theory), telephone call arrivals at a network switch do not occur at fixed intervals; they follow a **Poisson Point Process**:
$$P(k \text{ calls in interval } t) = \frac{(\lambda t)^k e^{-\lambda t}}{k!}$$
where $\lambda$ is the average call arrival rate.

The inter-arrival time between consecutive calls is exponentially distributed:
$$\Delta t = -\frac{\ln(1 - U)}{\lambda}, \quad U \sim \text{Uniform}(0, 1)$$

TeleBill Pro's built-in simulation modal (`public/app.js` and `src/modules/cdr/cdr.service.ts`):
1. Takes a target number of calls $N$ and arrival intensity $\lambda$.
2. Generates inter-arrival timestamps following the exponential distribution.
3. Assigns call durations using a log-normal distribution (representing short consumer calls mixed with occasional long-duration calls).
4. Generates realistic call categories (`LOCAL`, `STD`, `ISD`, `ROAMING`) and completes or drops calls based on standard network completion probabilities ($90\%$ completed, $5\%$ busy, $5\%$ no answer).

---

## Category 6: Software Engineering, Testing & System Architecture

### Q16. What is the Test Pyramid in TeleBill Pro, and what were the empirical results?
**Answer:**
TeleBill Pro enforces a strict four-tier testing hierarchy following industry best practices:
```
           / \
          /   \     Tier 4: Real-World Workloads (4 tests)
         /-----\
        /       \   Tier 3: Cross-Feature Integration (12 tests)
       /---------\
      /           \ Tier 2: Boundary & Corner Cases (52 tests)
     /-------------\
    /               \ Tier 1: Core Feature Coverage (50 tests)
   /-----------------\
  /  Integration (89) \ Integration Suites (Auth, Billing, CDR, Stress)
 /---------------------\
/      Unit (25)        \ Unit Suites (Rating Engine, HWMA, Token)
-------------------------
```
- **Total Test Count:** **232 automated tests** across all suites.
- **Pass Rate:** **232 / 232 (100% Pass Rate)**.
- **Execution Speed:** Full E2E suite runs in $\approx 13.5\text{ seconds}$ via our in-process test runner (`tests/e2e/test-runner.ts`).
- **Zero 503 Swallows:** All tests assert strict HTTP status codes and exact JSON response structures without ignoring error payloads.

---

### Q17. How does TeleBill Pro prevent SQL Injection vulnerabilities?
**Answer:**
TeleBill Pro uses **Prisma ORM**, which utilizes parameterized queries and prepared statements at the Rust database engine layer.
- Query inputs are never concatenated directly into raw SQL strings.
- Values passed to `where`, `data`, and `select` clauses are transmitted to the SQLite engine as isolated parameter values, completely neutralizing SQL injection attacks.
- For audit safety, any custom queries or pragmas (such as WAL setup) are hardcoded without user interpolation.

---

### Q18. How is Cross-Site Scripting (XSS) mitigated on the frontend?
**Answer:**
1. **HTTP Security Headers via Helmet:** The Express backend implements `helmet()`, injecting:
   - `Content-Security-Policy` (CSP)
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: SAMEORIGIN`
2. **DOM Text Escaping:** In `public/app.js`, dynamic data retrieved from the API (such as customer names, call destinations, or plan names) is rendered into the DOM using `textContent` or sanitized DOM nodes rather than dangerous `innerHTML` string concatenations.

---

### Q19. Explain the difference between BSS and OSS in telecommunications. Where does TeleBill Pro fit?
**Answer:**
- **OSS (Operations Support System):** Manages the physical and logical telecom network infrastructure—radio towers, fiber switches, IP routers, fault monitoring, network performance, and call routing switches (e.g., FreeSWITCH, Asterisk, OpenSIPS).
- **BSS (Business Support System):** Manages customer-facing and business operations—product catalog, subscriber onboarding, rating and charging, billing, invoicing, payments, revenue assurance, and customer care.
- **TeleBill Pro's Classification:** TeleBill Pro is a comprehensive **BSS (Business Support System)**. It ingests CDRs produced by network switches (OSS), rates them, applies customer tariffs, generates tax invoices, processes payments, and produces business intelligence reports.

---

### Q20. What is Call Barring, and how is it implemented when a customer account is suspended?
**Answer:**
Call Barring is an operational telecom feature that prevents a subscriber from initiating outbound calls when their account is suspended or delinquent.

In `src/modules/cdr/cdr.service.ts`:
1. When a CDR is received for ingestion, the service resolves the originating caller number to an active customer profile.
2. It verifies the subscriber's account status:
   ```typescript
   if (customer.status !== 'ACTIVE') {
     throw new ValidationError(`Call barred: Subscriber account status is ${customer.status}`);
   }
   ```
3. If the customer is `SUSPENDED` (e.g., for non-payment) or `INACTIVE`, the call is immediately rejected with HTTP `400 Bad Request`, preventing unauthorized network usage.

---

### Q21. How are PDF Invoices generated in TeleBill Pro, and why are they vector-rendered?
**Answer:**
In `src/modules/billing/invoice-pdf.service.ts`, invoices are generated server-side using **`pdfkit`**:
1. **Vector Typography & Layout:** Lines, tables, and borders are drawn using vector path operations (`doc.moveTo().lineTo().stroke()`), and text is rendered using embedded scalable fonts rather than raster images.
2. **Advantages:**
   - Tiny file size ($\approx 15\text{--}25\text{ KB}$ per invoice).
   - High visual fidelity at any zoom level or high-DPI print resolution.
   - Exact placement of itemized charge breakdowns, Indian GST compliance footnotes, and transaction QR mockups.
3. **HTTP Streaming:** The PDF is streamed directly to the HTTP response buffer (`res.setHeader('Content-Type', 'application/pdf')`), allowing instant browser preview and download without saving temporary files to disk.

---

### Q22. What happens if a customer changes their tariff plan mid-billing-cycle?
**Answer:**
TeleBill Pro preserves **Historical Rating Integrity**:
1. When a plan change is requested, the customer's `current_plan_id` in the `Customer` record is updated for future calls and upcoming billing runs.
2. Existing unbilled CDRs that were already ingested retain their original calculated charge and rate snapshots.
3. When the monthly billing cycle runs, the new base rental applies to the new cycle, while historical CDRs reflect the rates in effect at the time the calls were made. This prevents retroactive rate manipulation.

---

### Q23. What role does the Audit Log module play in telecom compliance?
**Answer:**
Telecom operators are legally required by regulatory bodies (such as TRAI in India or FCC in the US) to maintain an immutable audit trail of administrative actions.

In TeleBill Pro:
- The `AuditLog` table records:
  - Timestamp (`timestamp`)
  - Acting User ID (`user_id`)
  - Target Entity (`entity_type`: `CUSTOMER`, `PLAN`, `INVOICE`, `PAYMENT`, `SYSTEM`)
  - Operation (`action`: `CREATE`, `UPDATE`, `DELETE`, `BILLING_RUN`, `DEDUPLICATION`)
  - Old and New Value Payloads (`payload` in JSON format)
  - IP Address and User Agent
- This guarantees full non-repudiation: if an administrator modifies a tariff rate or waives an invoice, the event is permanently recorded in the audit log.

---

### Q24. How is the Front-End SPA structured without a heavy framework like React or Angular?
**Answer:**
The frontend is built using **Vanilla ES6+ JavaScript, CSS3 Variables, and Semantic HTML5**:
1. **Zero Build Step:** Runs directly in any modern browser without Webpack, Vite, or Babel bundling overhead.
2. **State Management:** A lightweight reactive state object stores the current user session, active JWT token, and loaded records.
3. **Dynamic Dashboard:** Leverages **`Chart.js`** to render interactive canvas charts for 6-month revenue trends and traffic distribution doughnuts.
4. **Role Switcher Demo Bar:** Includes a 1-click header banner that allows evaluators and professors to instantly switch between `Admin`, `Operator`, and `Customer` perspectives without manually typing passwords.

---

### Q25. How do you calculate Aging Debt and Accounts Receivable metrics?
**Answer:**
In `src/modules/report/report.service.ts`:
Unpaid invoices are grouped into standard accounting aging buckets based on the difference between the current date and the invoice `due_date`:
1. **Current (Not Yet Due):** `due_date >= now`
2. **1–30 Days Overdue:** `now - due_date <= 30 days`
3. **31–60 Days Overdue:** `31 <= (now - due_date) <= 60 days`
4. **61–90 Days Overdue:** `61 <= (now - due_date) <= 90 days`
5. **90+ Days Overdue (Bad Debt Risk):** `now - due_date > 90 days`

The report aggregates the total outstanding balance in each bucket, enabling management to identify revenue leakage and trigger automated suspension warnings.

---

### Q26. Summarize the key original engineering innovations in TeleBill Pro compared to the GitHub reference projects.
**Answer:**
After conducting our Reference Repository Audit of `bishalogy/billing`, `vBilling`, and `BillRun`:
1. **Mathematical Rigor:** Unlike the references which suffered from binary floating-point drift or plain integer truncations, TeleBill Pro implements strict **fixed-point decimal arithmetic** (`decimal.js`).
2. **Statutory GST Tax Isolation:** Implements tax isolation on past delinquent arrears, preventing illegal compound taxation present in basic billing scripts.
3. **Cryptographic Idempotent Deduplication:** Uses **SHA-256 canonical hashing** to guarantee that re-transmitted CDRs cannot double-bill subscribers.
4. **Predictive Data Science:** Integrates a **Hybrid HWMA Explainable Forecasting Algorithm** to eliminate subscriber bill shock.
5. **Architectural Simplicity:** Avoids the heavy external C/VoIP daemons of vBilling (FreeSWITCH) and the complex PHP/MongoDB distributed cluster requirements of BillRun, packaging a complete carrier-grade BSS into a **modular, self-contained, zero-dependency Node.js/TypeScript monolith** verified by **232 automated tests**.
