# TeleBill Pro — Project Overview & Academic Specification

## 1. Academic Context & Project Metadata

| Attribute | Specification Details |
| :--- | :--- |
| **Project Title** | **TeleBill Pro** — Smart Telephone Billing & Telecom Management Platform |
| **Academic Program** | Bachelor of Technology (B.Tech) in Computer Science & Engineering (Data Science) |
| **Institutional Affiliation** | University of Engineering & Management (UEM), Kolkata |
| **Curricular Course** | Innovative Project-I (Semester Academic Evaluation) |
| **Engineering Classification** | Full-Stack Enterprise Software Prototype / Telecom BSS System |
| **Primary System Paradigm** | Modular Monolithic Architecture with Deterministic Fixed-Point Rating Engine |
| **Persistence Engine** | SQLite with Write-Ahead Logging (WAL) via Prisma ORM |
| **Verification Standard** | 232 Automated Tests Across Unit, Integration, and 4-Tier E2E Suites (100% Pass) |

---

## 2. Industry & Telecom Background

In the contemporary telecommunications industry, Business Support Systems (BSS) and Operations Support Systems (OSS) represent the mission-critical core responsible for customer onboarding, service provisioning, rating of network call events, invoice generation, and revenue assurance.

Traditional telecom rating landscapes historically maintained rigid operational silos between:
1. **Prepaid Services:** Intelligent Network (IN) systems processing real-time credit checks, instant balance decrements, and hard call termination upon balance exhaustion.
2. **Postpaid Services:** Batch-oriented rating and monthly billing cycle engines aggregating Call Detail Records (CDRs), calculating fixed rentals, assessing taxes, and rolling over unpaid arrears.

As modern telecom operators transition toward converged charging architectures, there is a fundamental demand for unified platforms capable of handling both prepaid credit enforcement and postpaid multi-cycle invoicing through a single, mathematically rigorous rating core.

---

## 3. Problem Statement & Engineering Challenges

Conventional college-level and small-scale commercial billing implementations frequently succumb to catastrophic design flaws:

1. **IEEE-754 Floating-Point Inaccuracy (Drift):** Standard JavaScript numbers (`Number` IEEE-754 double precision) introduce non-deterministic rounding errors in monetary and fraction-of-a-minute ratings (e.g., `0.1 + 0.2 = 0.30000000000000004`). In financial billing engines processing millions of pulses, this creates severe revenue loss and audit discrepancies.
2. **CDR Replay & Duplicate Billing Ingestion:** In network transmission, network probes and mediation gateways frequently retransmit CDR packets during network retries. Without idempotent deduplication fingerprints, subscribers suffer duplicate charges for a single physical telephone call.
3. **Statutory Tax Misapplication on Debt Rollover:** Standard naive billing systems recalculate 18% Goods and Services Tax (GST) across the aggregate invoice total including previous unpaid debt, unlawfully subjecting previously taxed arrears to cascading compound taxation.
4. **Security Vulnerabilities (IDOR & Weak Hashing):** Legacy software frequently uses outdated MD5/SHA-1 hashing and fails to enforce resource-level tenancy boundaries, enabling customer accounts to read or modify neighboring subscriber invoices via Insecure Direct Object Reference (IDOR) attacks.
5. **Subscriber "Bill Shock" & Lack of Transparency:** Postpaid subscribers have historically faced anxiety regarding unexpected high bills at month-end due to opaque pricing rules and absence of intra-cycle predictive usage analytics.

---

## 4. Project Objectives

**TeleBill Pro** was engineered to resolve these challenges through an end-to-end commercial-grade telecom management platform:

- **Mathematical Determinism:** Zero floating-point drift across all rates, line items, and invoice totals using fixed-point integer/arbitrary-precision decimals (`decimal.js`).
- **Deterministic Deduplication:** Cryptographic SHA-256 fingerprinting (`caller:receiver:isoTimestamp:duration`) rejecting duplicate CDR ingestions idempotently.
- **Unified Prepaid/Postpaid Lifecycle:** Real-time prepaid balance deduction, call barring upon wallet exhaustion, emergency top-ups, and postpaid cycle billing with prorated rentals.
- **Statutory Tax Isolation:** Strict isolation of monthly 18% GST exclusively on taxable telecom services, rolling over past arrears with zero tax compounding.
- **Explainable Predictive Analytics:** A hybrid predictive bill engine combining intra-cycle Daily Run-Rate extrapolation with historical Exponential Moving Averages (HWMA) and natural language narratives.
- **Enterprise Security:** Cryptographic password hashing (Bcrypt cost factor 12), ephemeral stateless JWT session management (60m lifespan), and comprehensive 3-tier Role-Based Access Control (`ADMIN`, `STAFF`, `CUSTOMER`) with anti-IDOR perimeter checks.
- **Demonstration Suite:** High-fidelity Poisson traffic simulation, CSV batch uploads, vector PDF invoice generation, and interactive executive/customer portals.

---

## 5. Technology Stack Justification

| Layer | Selected Technology | Technical Justification |
| :--- | :--- | :--- |
| **Runtime Environment** | Node.js LTS v20.18.1 | High-throughput asynchronous event loop ideal for non-blocking I/O, REST endpoints, and streaming CDR ingestion. |
| **Language** | TypeScript 5.6.3 | Compile-time static type safety eliminating `undefined` property errors across financial DTOs, rating models, and API interfaces. |
| **Server Framework** | Express.js 4.21.1 | Lightweight, unopinionated, highly extensible HTTP pipeline supporting modular routing, middleware authentication, and error containment. |
| **Database & ORM** | SQLite 3 + Prisma ORM 5.22.0 | Zero-dependency local setup configured with Write-Ahead Logging (WAL) mode (`PRAGMA journal_mode = WAL`), enabling concurrent non-blocking reads during active transaction writes. |
| **Precision Math** | Decimal.js 10.4.3 | Arbitrary-precision decimal arithmetic adhering to `ROUND_HALF_UP` banking standards (`DECIMAL(10,4)` for rates, `DECIMAL(10,2)` for currency). |
| **Security & Auth** | BcryptJS + JSONWebToken | Industry-standard password stretching (2^12 rounds ~300ms compute wall) and tamper-proof HS256 HMAC tokens. |
| **Document Engine** | PDFKit 0.15.1 | Server-side programmatic vector PDF invoice generation formatted with statutory corporate headers, tax breakdowns, and payment stubs. |
| **Frontend UI** | Modern HTML5 + Tailwind CSS + Lucide Icons + Chart.js | Zero-build responsive Single Page Application (SPA) served directly from Express static middleware with interactive analytics charts. |
