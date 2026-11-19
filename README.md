# TeleBill Pro – Telephone Billing & Operations System (BSS)

A carrier-grade, full-stack telecommunication billing and subscriber management platform built with Node.js, TypeScript, Express, Prisma ORM, and SQLite (WAL Mode).

---

## 📌 Project Overview
- **Project Title:** Telephone Billing System (TeleBill Pro)
- **Author / Presenter:** Somankan Bera (Enrollment Number: `12025002037223`)
- **Department:** Computer Science and Engineering (Data Science)
- **Institution:** University of Engineering & Management (UEM), Kolkata
- **Academic Session:** 2026–2027

---

## 🚀 Key Features

1. **Real-Time Call Rating Engine (CDR):**
   - Discrete pulse rating math supporting standard 60-second pulses and 1-second per-second pulses.
   - Per-minute rate matrices for Local, STD, and ISD calls.
   - Multi-bucket free talk-time quota tracking.

2. **Deterministic Cryptographic Deduplication (SHA-256):**
   - Automatically computes a unique fingerprint: `SHA256(caller + receiver + timestamp + duration)`.
   - Rejects 100% of network re-transmissions and duplicate call records to eliminate overbilling.

3. **Automated Monthly Invoicing with 18% Statutory GST:**
   - 1-click batch billing cycle compiling rentals and unbilled usage across all active subscribers.
   - Automatic statutory tax calculation (9% CGST + 9% SGST = 18% GST).
   - Instant downloadable itemized PDF invoices.

4. **3-Tier Role-Based Access Control (RBAC):**
   - **Admin:** Master control over tariffs, subscribers, batch billing runs, and revenue analytics.
   - **Operator (Staff):** Day-to-day subscriber registration and call monitoring. Tariff creation is locked in **Read-Only** mode to prevent price tampering.
   - **Customer:** Self-service portal to monitor live remaining quota buckets, wallet balance, and recent calls.

5. **AI Mid-Cycle Bill Forecasting:**
   - Analyzes mid-month call velocity and talk-time trends to forecast end-of-month invoice totals with confidence scoring to eliminate "bill shock".

6. **1-Click Clean Demo Reset:**
   - Instant database re-seeding endpoint (`npm run db:seed`) to restore fresh benchmark state during live presentations.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | HTML5, Modern CSS3 (Glassmorphism Sidebar & Technical Minimalist), Vanilla JavaScript (ES6+), Chart.js |
| **Backend API** | Node.js, TypeScript, Express.js (RESTful Architecture) |
| **Database & ORM** | SQLite in Write-Ahead Logging (WAL) Mode, Prisma ORM (11 Relational Tables) |
| **Testing** | Jest (232 Automated Unit, Integration & E2E Tests Passing) |
| **Deployment** | Railway PaaS (`https://telebill-web-production.up.railway.app`) |

---

## ⚙️ Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/Somankan-DS/Telephone_Billing_System.git
cd Telephone_Billing_System
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 4. Initialize Database & Seed Demo Data
```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### 5. Start the Server
```bash
npm run dev
```
Open [http://localhost:5000](http://localhost:5000) in your web browser.

---

## 🧪 Testing & Verification
Run the comprehensive 232 automated test suite:
```bash
npm test
```

---

## 📄 Documentation
- **Project Report:** See [`TeleBill_Pro_Software_Project_Report.pdf`](./TeleBill_Pro_Software_Project_Report.pdf) for the complete 16-chapter academic report.
- **Presentation Deck:** See [`TeleBill_Pro_Tabs_Walkthrough.pptx`](./TeleBill_Pro_Tabs_Walkthrough.pptx) for the slide-by-slide walkthrough.
