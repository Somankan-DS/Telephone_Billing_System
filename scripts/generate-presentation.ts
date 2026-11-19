import PptxGenJS from 'pptxgenjs';
import * as path from 'path';

async function generatePresentation() {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = 'TeleBill Pro — Telecom Billing & Management Platform';
  pptx.author = 'Innovative Project-I Team, CSE (Data Science), UEM Kolkata';
  pptx.company = 'University of Engineering & Management, Kolkata';

  // Palette constants
  const NAVY = '0F172A';
  const BLUE = '2563EB';
  const LIGHT_BLUE = '38BDF8';
  const DARK_SLATE = '1E293B';
  const TEXT_DARK = '0F172A';
  const TEXT_MUTED = '475569';
  const BG_LIGHT = 'F8FAFC';
  const WHITE = 'FFFFFF';
  const GREEN = '10B981';
  const BORDER_COLOR = 'CBD5E1';

  // Helper to add standard header and footer to a slide
  function addSlideChrome(slide: PptxGenJS.Slide, titleText: string, categoryText: string, slideNum: number) {
    slide.background = { color: BG_LIGHT };

    // Header bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 1.15,
      fill: { color: NAVY }
    });

    // Top Category text
    slide.addText(categoryText.toUpperCase(), {
      x: 0.8,
      y: 0.15,
      w: 11.5,
      h: 0.3,
      fontSize: 10,
      fontFace: 'Arial',
      color: LIGHT_BLUE,
      bold: true
    });

    // Main Slide Title
    slide.addText(titleText, {
      x: 0.8,
      y: 0.45,
      w: 11.5,
      h: 0.55,
      fontSize: 20,
      fontFace: 'Arial',
      color: WHITE,
      bold: true
    });

    // Footer rule
    slide.addShape(pptx.ShapeType.line, {
      x: 0.8,
      y: 7.0,
      w: 11.733,
      h: 0,
      line: { color: BORDER_COLOR, width: 1 }
    });

    // Footer text
    slide.addText('TeleBill Pro  |  Innovative Project-I  |  CSE (Data Science)  |  UEM Kolkata', {
      x: 0.8,
      y: 7.05,
      w: 9.0,
      h: 0.35,
      fontSize: 10,
      fontFace: 'Arial',
      color: TEXT_MUTED
    });

    // Slide Number
    slide.addText(`Slide ${slideNum} of 15`, {
      x: 10.5,
      y: 7.05,
      w: 2.0,
      h: 0.35,
      fontSize: 10,
      fontFace: 'Arial',
      color: TEXT_MUTED,
      align: 'right'
    });
  }

  // ==========================================
  // SLIDE 1: Title Slide (Dark Theme)
  // ==========================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: NAVY };

    // Accent line
    slide.addShape(pptx.ShapeType.rect, {
      x: 1.2,
      y: 1.6,
      w: 1.2,
      h: 0.1,
      fill: { color: BLUE }
    });

    // Main Title
    slide.addText('TELEBILL PRO', {
      x: 1.2,
      y: 1.8,
      w: 11.0,
      h: 1.0,
      fontSize: 44,
      fontFace: 'Arial',
      color: WHITE,
      bold: true
    });

    // Subtitle
    slide.addText('Smart Telephone Billing & Telecom Management Platform (OSS/BSS)', {
      x: 1.2,
      y: 2.8,
      w: 11.0,
      h: 0.6,
      fontSize: 20,
      fontFace: 'Arial',
      color: LIGHT_BLUE
    });

    // Card with context
    slide.addShape(pptx.ShapeType.rect, {
      x: 1.2,
      y: 3.7,
      w: 10.9,
      h: 2.7,
      fill: { color: DARK_SLATE },
      line: { color: '334155', width: 1 }
    });

    slide.addText([
      { text: 'Academic Context:\n', options: { bold: true, color: WHITE, fontSize: 14 } },
      { text: 'Innovative Project-I (B.Tech 5th/6th Sem)\nDepartment of Computer Science & Engineering (Data Science)\nUniversity of Engineering & Management (UEM), Kolkata\n\n', options: { color: 'CBD5E1', fontSize: 13 } },
      { text: 'Core Engineering Pillars:\n', options: { bold: true, color: WHITE, fontSize: 14 } },
      { text: '• Fixed-Point Financial Rating (Decimal.js) with Zero IEEE-754 Drift\n• Cryptographic SHA-256 CDR Deduplication & SQLite WAL Concurrency\n• Statutory 18% GST Arrears Isolation & Hybrid HWMA Predictive Analytics', options: { color: '94A3B8', fontSize: 12 } }
    ], {
      x: 1.5,
      y: 3.9,
      w: 10.3,
      h: 2.3,
      fontFace: 'Arial'
    });
  }

  // ==========================================
  // SLIDE 2: Problem Statement & Telecom Context
  // ==========================================
  {
    const slide = pptx.addSlide();
    addSlideChrome(slide, 'Telecom BSS Challenges & Problem Statement', 'Background & Motivation', 2);

    const cards = [
      {
        title: '1. Floating-Point Financial Drift',
        desc: 'Standard binary float (Float64) causes cumulative rounding drift on fractional sub-minute pulse rates (e.g. INR 0.0167/sec), corrupting general ledgers and violating tax audits.',
        accent: 'EF4444'
      },
      {
        title: '2. Duplicate CDR Ingestion',
        desc: 'Network switch retries and buffer flushes duplicate CDR packets. Naive auto-increment primary keys double-bill subscribers, causing customer churn and regulatory penalties.',
        accent: 'F59E0B'
      },
      {
        title: '3. Compound Arrears Taxation',
        desc: 'Rolling over unpaid delinquent debt into subsequent billing cycles leads to naive re-taxation. Arrears are taxed a second time, violating statutory GST regulations.',
        accent: '8B5CF6'
      },
      {
        title: '4. End-of-Cycle Bill Shock',
        desc: 'Subscribers lack real-time visibility into intra-cycle call velocity. Traditional BSS platforms only calculate charges retroactively at invoice generation.',
        accent: '3B82F6'
      }
    ];

    cards.forEach((c, idx) => {
      const x = 0.8 + (idx % 2) * 5.95;
      const y = 1.45 + Math.floor(idx / 2) * 2.65;

      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: 5.75,
        h: 2.45,
        fill: { color: WHITE },
        line: { color: BORDER_COLOR, width: 1 }
      });

      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: 0.15,
        h: 2.45,
        fill: { color: c.accent }
      });

      slide.addText(c.title, {
        x: x + 0.35,
        y: y + 0.25,
        w: 5.2,
        h: 0.4,
        fontSize: 16,
        fontFace: 'Arial',
        color: NAVY,
        bold: true
      });

      slide.addText(c.desc, {
        x: x + 0.35,
        y: y + 0.75,
        w: 5.2,
        h: 1.5,
        fontSize: 13,
        fontFace: 'Arial',
        color: TEXT_MUTED
      });
    });
  }

  // ==========================================
  // SLIDE 3: TeleBill Pro Solution Overview
  // ==========================================
  {
    const slide = pptx.addSlide();
    addSlideChrome(slide, 'The Solution: Comprehensive OSS/BSS Platform', 'Platform Overview', 3);

    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 1.4,
      w: 11.733,
      h: 1.2,
      fill: { color: DARK_SLATE }
    });

    slide.addText('TeleBill Pro is a modular, high-integrity Business Support System (BSS) combining commercial-grade telecom rating precision with an explainable data science intelligence layer, packaged for zero-dependency execution.', {
      x: 1.1,
      y: 1.6,
      w: 11.1,
      h: 0.8,
      fontSize: 14,
      fontFace: 'Arial',
      color: WHITE
    });

    const pillars = [
      {
        title: 'Core Telecom BSS Engine',
        items: [
          'Prepaid Online Balance Deduction',
          'Postpaid 30-Day Billing Cycles',
          'Configurable Pulse Increments (1s / 60s)',
          'Bundled Free Allowance Buckets'
        ]
      },
      {
        title: 'Enterprise Financial Integrity',
        items: [
          'Arbitrary-precision Decimal.js Rating',
          'Statutory 18% GST Isolation on Arrears',
          'Vector PDF Invoices (PDFKit streaming)',
          'Simulated Payment Gateway & Wallet Credits'
        ]
      },
      {
        title: 'Data Science & Analytics',
        items: [
          'Poisson Point Process Traffic Simulation',
          'Hybrid HWMA Predictive Billing Engine',
          'Explainable Confidence & Burn-Rate Scores',
          'Aging Debt Buckets (1-30, 31-60, 90+ days)'
        ]
      }
    ];

    pillars.forEach((p, idx) => {
      const x = 0.8 + idx * 4.0;
      slide.addShape(pptx.ShapeType.rect, {
        x,
        y: 2.8,
        w: 3.733,
        h: 3.9,
        fill: { color: WHITE },
        line: { color: BORDER_COLOR, width: 1 }
      });

      slide.addShape(pptx.ShapeType.rect, {
        x,
        y: 2.8,
        w: 3.733,
        h: 0.6,
        fill: { color: BLUE }
      });

      slide.addText(p.title, {
        x,
        y: 2.9,
        w: 3.733,
        h: 0.4,
        fontSize: 13,
        fontFace: 'Arial',
        color: WHITE,
        bold: true,
        align: 'center'
      });

      slide.addText(p.items.map(item => `•  ${item}`).join('\n\n'), {
        x: x + 0.3,
        y: 3.6,
        w: 3.133,
        h: 2.9,
        fontSize: 12,
        fontFace: 'Arial',
        color: TEXT_DARK
      });
    });
  }

  // ==========================================
  // SLIDE 4: Reference Architecture Audit
  // ==========================================
  {
    const slide = pptx.addSlide();
    addSlideChrome(slide, 'Open-Source Reference Audit & Modernization', 'Engineering Evaluation', 4);

    const rows = [
      [
        { text: 'Evaluation Dimension', options: { bold: true, fill: { color: NAVY }, color: WHITE } },
        { text: 'Reference A: bishalogy/billing', options: { bold: true, fill: { color: NAVY }, color: WHITE } },
        { text: 'Reference B: vBilling', options: { bold: true, fill: { color: NAVY }, color: WHITE } },
        { text: 'Reference C: BillRun', options: { bold: true, fill: { color: NAVY }, color: WHITE } },
        { text: 'TeleBill Pro (Our Solution)', options: { bold: true, fill: { color: BLUE }, color: WHITE } }
      ],
      [
        { text: 'Tech Stack & Language', options: { bold: true } },
        { text: 'Legacy PHP 5 / MySQL' },
        { text: 'PHP / FreeSWITCH VoIP' },
        { text: 'PHP 7 / MongoDB Distributed' },
        { text: 'TypeScript / Node.js / Prisma', options: { bold: true, color: BLUE } }
      ],
      [
        { text: 'Financial Rating Math', options: { bold: true } },
        { text: 'Native PHP Float (Drift Risk)' },
        { text: 'Float / Micro-paisa drift' },
        { text: 'BCMath (Complex setup)' },
        { text: 'Decimal.js Fixed-Point (0.00% Drift)', options: { bold: true, color: GREEN } }
      ],
      [
        { text: 'CDR Deduplication', options: { bold: true } },
        { text: 'None (Double-bills on retry)' },
        { text: 'Switch Session ID only' },
        { text: 'MongoDB Hash Index' },
        { text: 'SHA-256 Canonical Fingerprint', options: { bold: true, color: GREEN } }
      ],
      [
        { text: 'Arrears GST Treatment', options: { bold: true } },
        { text: 'Compound Tax (Illegal)' },
        { text: 'Excluded tax logic' },
        { text: 'Jurisdiction complex lines' },
        { text: 'Statutory Isolation (0% Tax on Arrears)', options: { bold: true, color: GREEN } }
      ],
      [
        { text: 'Infrastructure Overhead', options: { bold: true } },
        { text: 'XAMPP / Apache dependency' },
        { text: 'Requires FreeSWITCH C Daemons' },
        { text: 'Requires MongoDB cluster' },
        { text: 'Zero-Daemon Monolith (SQLite WAL)', options: { bold: true, color: BLUE } }
      ],
      [
        { text: 'Predictive Intelligence', options: { bold: true } },
        { text: 'None (Static history)' },
        { text: 'None' },
        { text: 'External BI connector' },
        { text: 'Built-in Hybrid HWMA Forecasting', options: { bold: true, color: GREEN } }
      ]
    ];

    slide.addTable(rows, {
      x: 0.8,
      y: 1.45,
      w: 11.733,
      colW: [2.3, 2.3, 2.3, 2.3, 2.533],
      fontSize: 10,
      fontFace: 'Arial',
      border: { pt: 0.5, color: BORDER_COLOR }
    });
  }

  // ==========================================
  // SLIDE 5: Modular Monolith Architecture
  // ==========================================
  {
    const slide = pptx.addSlide();
    addSlideChrome(slide, 'System Architecture & Modular Monolith Design', 'Architecture (ADR-001)', 5);

    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 1.4,
      w: 11.733,
      h: 0.6,
      fill: { color: DARK_SLATE }
    });
    slide.addText('PRESENTATION LAYER: Vanilla ES6+ SPA  |  Chart.js 4.4  |  Interactive Modals  |  1-Click Role Switcher', {
      x: 0.8,
      y: 1.45,
      w: 11.733,
      h: 0.5,
      fontSize: 11,
      fontFace: 'Arial',
      color: WHITE,
      bold: true,
      align: 'center'
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 2.15,
      w: 11.733,
      h: 0.5,
      fill: { color: BLUE }
    });
    slide.addText('REST API GATEWAY: Express 4.21  |  Helmet Security  |  CORS  |  JWT Auth & RBAC  |  Dual /api & /api/v1', {
      x: 0.8,
      y: 2.2,
      w: 11.733,
      h: 0.4,
      fontSize: 11,
      fontFace: 'Arial',
      color: WHITE,
      bold: true,
      align: 'center'
    });

    const modules = [
      { name: 'Auth & Identity', tech: 'Bcrypt 12, JWT 60m, Anti-IDOR' },
      { name: 'Customer Subsystem', tech: 'Lifecycle, Wallets, Barring' },
      { name: 'Tariff & Catalog', tech: 'Pulse sizes, Allowance Buckets' },
      { name: 'CDR Ingestion', tech: 'SHA-256 Dedup, Pulse Rating' },
      { name: 'Monthly Billing', tech: 'Postpaid runs, Arrears, GST' },
      { name: 'Payment Gateway', tech: 'Idempotent, PDFKit Streaming' },
      { name: 'HWMA Prediction', tech: 'Velocity Burn-rate, Holt-Winters' },
      { name: 'Reporting & Analytics', tech: 'Aging Debt, ARPU, Usage Mix' }
    ];

    modules.forEach((m, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const x = 0.8 + col * 3.0;
      const y = 2.8 + row * 1.5;

      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: 2.733,
        h: 1.35,
        fill: { color: WHITE },
        line: { color: BORDER_COLOR, width: 1 }
      });

      slide.addText(m.name, {
        x: x + 0.15,
        y: y + 0.15,
        w: 2.433,
        h: 0.35,
        fontSize: 12,
        fontFace: 'Arial',
        color: NAVY,
        bold: true
      });

      slide.addText(m.tech, {
        x: x + 0.15,
        y: y + 0.55,
        w: 2.433,
        h: 0.7,
        fontSize: 10,
        fontFace: 'Arial',
        color: TEXT_MUTED
      });
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 6.0,
      w: 11.733,
      h: 0.7,
      fill: { color: NAVY }
    });
    slide.addText('PERSISTENCE LAYER: SQLite 3 with Write-Ahead Logging (WAL)  |  Prisma 5.22 ORM  |  ACID Transactions', {
      x: 0.8,
      y: 6.1,
      w: 11.733,
      h: 0.5,
      fontSize: 12,
      fontFace: 'Arial',
      color: LIGHT_BLUE,
      bold: true,
      align: 'center'
    });
  }

  // ==========================================
  // SLIDE 6: Relational Database Schema
  // ==========================================
  {
    const slide = pptx.addSlide();
    addSlideChrome(slide, 'Relational Database Schema (11 Tables & WAL)', 'Data Architecture', 6);

    const tables = [
      { name: '1. User', fields: 'id, username, password_hash, role, customer_id' },
      { name: '2. Customer', fields: 'id, name, phone, email, account_type, balance, status' },
      { name: '3. TariffPlan', fields: 'id, plan_code, pulse_seconds, local_rate, std_rate, isd_rate' },
      { name: '4. FreeAllowanceBucket', fields: 'id, customer_id, category, total_units, remaining_units' },
      { name: '5. CallDetailRecord', fields: 'id, call_hash (UNIQUE), duration, pulse_count, charge' },
      { name: '6. Invoice', fields: 'id, invoice_number, subtotal, tax_amount, arrears_applied, total' },
      { name: '7. InvoiceItem', fields: 'id, invoice_id, item_type, description, amount, rate' },
      { name: '8. Payment', fields: 'id, invoice_id, customer_id, amount, method, status' },
      { name: '9. Notification', fields: 'id, customer_id, title, message, is_read, created_at' },
      { name: '10. UsageSummary', fields: 'id, customer_id, billing_period, total_minutes, total_calls' },
      { name: '11. AuditLog', fields: 'id, user_id, entity_type, action, payload, timestamp' }
    ];

    tables.forEach((t, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = 0.8 + col * 4.0;
      const y = 1.45 + row * 1.3;

      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: 3.733,
        h: 1.15,
        fill: { color: WHITE },
        line: { color: BORDER_COLOR, width: 1 }
      });

      slide.addText(t.name, {
        x: x + 0.15,
        y: y + 0.1,
        w: 3.433,
        h: 0.3,
        fontSize: 12,
        fontFace: 'Arial',
        color: NAVY,
        bold: true
      });

      slide.addText(t.fields, {
        x: x + 0.15,
        y: y + 0.45,
        w: 3.433,
        h: 0.6,
        fontSize: 10,
        fontFace: 'Courier New',
        color: TEXT_MUTED
      });
    });

    // Pragmas callout box
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 5.65,
      w: 11.733,
      h: 1.1,
      fill: { color: DARK_SLATE }
    });

    slide.addText([
      { text: 'Database WAL Mode Pragmas (ADR-003):\n', options: { bold: true, color: LIGHT_BLUE, fontSize: 11 } },
      { text: 'PRAGMA journal_mode = WAL;   PRAGMA busy_timeout = 5000;   PRAGMA synchronous = NORMAL;   PRAGMA foreign_keys = ON;\n', options: { fontFace: 'Courier New', color: WHITE, fontSize: 11 } },
      { text: 'Guarantees that readers never block writers and writers never block readers under concurrent load.', options: { color: 'CBD5E1', fontSize: 10 } }
    ], {
      x: 1.0,
      y: 5.75,
      w: 11.3,
      h: 0.9,
      fontFace: 'Arial'
    });
  }

  // ==========================================
  // SLIDE 7: Deterministic Rating Engine
  // ==========================================
  {
    const slide = pptx.addSlide();
    addSlideChrome(slide, 'Deterministic Rating Engine & Pulse Rounding', 'Rating Mechanics (ADR-002)', 7);

    // Left Box: Pulse Rating Algorithm
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 1.45,
      w: 5.7,
      h: 5.3,
      fill: { color: WHITE },
      line: { color: BORDER_COLOR, width: 1 }
    });

    slide.addText('Pulse Quantization Mathematics', {
      x: 1.1,
      y: 1.65,
      w: 5.1,
      h: 0.4,
      fontSize: 15,
      fontFace: 'Arial',
      color: NAVY,
      bold: true
    });

    slide.addText([
      { text: 'Discrete Pulse Intervals:\n', options: { bold: true, color: BLUE } },
      { text: 'Calls are rated in discrete blocks (e.g. 60s per-minute or 1s per-second):\n\n' },
      { text: 'Pulse Count = ceil(billable_seconds / pulse_size)\n\n', options: { fontFace: 'Courier New', bold: true } },
      { text: 'Pulse Rate Calculation:\n', options: { bold: true, color: BLUE } },
      { text: 'Pulse Rate = (Tariff Rate per Min × pulse_size) / 60\n\n', options: { fontFace: 'Courier New', bold: true } },
      { text: 'Exact Charge (Decimal.js):\n', options: { bold: true, color: BLUE } },
      { text: 'Raw Cost = Pulse Count × Pulse Rate\n', options: { fontFace: 'Courier New', bold: true } },
      { text: 'Final Charge = Raw Cost.toDecimalPlaces(2, ROUND_HALF_UP)\n\n', options: { fontFace: 'Courier New', bold: true } },
      { text: 'Call Completion Gate:\n', options: { bold: true, color: BLUE } },
      { text: 'Status != COMPLETED (BUSY, FAILED, NO_ANSWER) -> Billable seconds = 0, Charge = INR 0.00' }
    ], {
      x: 1.1,
      y: 2.1,
      w: 5.1,
      h: 4.4,
      fontSize: 11,
      fontFace: 'Arial',
      color: TEXT_DARK
    });

    // Right Box: Concrete Pulse Examples
    slide.addShape(pptx.ShapeType.rect, {
      x: 6.833,
      y: 1.45,
      w: 5.7,
      h: 5.3,
      fill: { color: WHITE },
      line: { color: BORDER_COLOR, width: 1 }
    });

    slide.addText('Pulse Quantization Examples', {
      x: 7.133,
      y: 1.65,
      w: 5.1,
      h: 0.4,
      fontSize: 15,
      fontFace: 'Arial',
      color: NAVY,
      bold: true
    });

    const exRows = [
      [
        { text: 'Duration', options: { bold: true, fill: { color: DARK_SLATE }, color: WHITE } },
        { text: 'Pulse Config', options: { bold: true, fill: { color: DARK_SLATE }, color: WHITE } },
        { text: 'Pulses', options: { bold: true, fill: { color: DARK_SLATE }, color: WHITE } },
        { text: 'Charge (INR 1.00/min)', options: { bold: true, fill: { color: BLUE }, color: WHITE } }
      ],
      [{ text: '5 seconds' }, { text: '60s pulse' }, { text: '1 pulse' }, { text: 'INR 1.00' }],
      [{ text: '60 seconds' }, { text: '60s pulse' }, { text: '1 pulse' }, { text: 'INR 1.00' }],
      [{ text: '61 seconds' }, { text: '60s pulse' }, { text: '2 pulses' }, { text: 'INR 2.00' }],
      [{ text: '125 seconds' }, { text: '60s pulse' }, { text: '3 pulses' }, { text: 'INR 3.00' }],
      [{ text: '45 seconds' }, { text: '1s pulse' }, { text: '45 pulses' }, { text: 'INR 0.75' }],
      [{ text: '90 seconds' }, { text: '30s pulse' }, { text: '3 pulses' }, { text: 'INR 1.50' }],
      [{ text: 'Call FAILED' }, { text: '60s pulse' }, { text: '0 pulses' }, { text: 'INR 0.00', options: { bold: true, color: GREEN } }]
    ];

    slide.addTable(exRows, {
      x: 7.033,
      y: 2.2,
      w: 5.3,
      colW: [1.3, 1.4, 1.1, 1.5],
      fontSize: 10,
      fontFace: 'Arial',
      border: { pt: 0.5, color: BORDER_COLOR }
    });

    slide.addText('Guaranteed Invariance: Every calculation is executed in base-10 fixed-point arithmetic with 0.00% precision loss.', {
      x: 7.133,
      y: 5.8,
      w: 5.1,
      h: 0.8,
      fontSize: 11,
      fontFace: 'Arial',
      color: BLUE,
      bold: true
    });
  }

  // ==========================================
  // SLIDE 8: CDR Ingestion & Deduplication
  // ==========================================
  {
    const slide = pptx.addSlide();
    addSlideChrome(slide, 'CDR Ingestion & Cryptographic Deduplication', 'Data Pipeline (ADR-004)', 8);

    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 1.45,
      w: 11.733,
      h: 1.2,
      fill: { color: DARK_SLATE }
    });

    slide.addText([
      { text: 'Deterministic SHA-256 Fingerprint Formula:\n', options: { bold: true, color: LIGHT_BLUE, fontSize: 13 } },
      { text: 'call_hash = SHA256( customer_id | caller_number | receiver_number | start_time_ISO | duration )\n', options: { fontFace: 'Courier New', color: WHITE, bold: true, fontSize: 13 } },
      { text: 'Stored as a UNIQUE INDEX in SQLite to provide instantaneous O(1) duplicate collision detection.', options: { color: 'CBD5E1', fontSize: 11 } }
    ], {
      x: 1.1,
      y: 1.55,
      w: 11.1,
      h: 1.0,
      fontFace: 'Arial'
    });

    const steps = [
      {
        num: 'STEP 1',
        title: 'Network CDR Ingestion',
        desc: 'CDR packet received from switch or CSV batch. Originating caller number resolved to customer profile. Barring verified.'
      },
      {
        num: 'STEP 2',
        title: 'Fingerprint Generation',
        desc: 'Canonical pipe-separated string assembled and passed to SHA-256 cryptographic digest generator.'
      },
      {
        num: 'STEP 3',
        title: 'Collision Verification',
        desc: 'Query checks call_hash. If found, logs dedup audit, skips charging, and returns idempotent HTTP 200.'
      },
      {
        num: 'STEP 4',
        title: 'Pulse Rating & Commit',
        desc: 'If unique: rates duration against plan pulse, deducts allowance or prepaid balance, and commits record.'
      }
    ];

    steps.forEach((s, idx) => {
      const x = 0.8 + idx * 3.0;
      slide.addShape(pptx.ShapeType.rect, {
        x,
        y: 2.9,
        w: 2.733,
        h: 3.8,
        fill: { color: WHITE },
        line: { color: BORDER_COLOR, width: 1 }
      });

      slide.addShape(pptx.ShapeType.rect, {
        x,
        y: 2.9,
        w: 2.733,
        h: 0.45,
        fill: { color: BLUE }
      });

      slide.addText(s.num, {
        x,
        y: 2.95,
        w: 2.733,
        h: 0.35,
        fontSize: 11,
        fontFace: 'Arial',
        color: WHITE,
        bold: true,
        align: 'center'
      });

      slide.addText(s.title, {
        x: x + 0.15,
        y: 3.5,
        w: 2.433,
        h: 0.5,
        fontSize: 13,
        fontFace: 'Arial',
        color: NAVY,
        bold: true
      });

      slide.addText(s.desc, {
        x: x + 0.15,
        y: 4.1,
        w: 2.433,
        h: 2.4,
        fontSize: 11,
        fontFace: 'Arial',
        color: TEXT_MUTED
      });
    });
  }

  // ==========================================
  // SLIDE 9: Monthly Postpaid Billing & GST Isolation
  // ==========================================
  {
    const slide = pptx.addSlide();
    addSlideChrome(slide, 'Monthly Postpaid Billing & Statutory 18% GST Isolation', 'Financial Engine', 9);

    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 1.45,
      w: 6.8,
      h: 5.3,
      fill: { color: WHITE },
      line: { color: BORDER_COLOR, width: 1 }
    });

    slide.addText('Statutory GST Arrears Isolation', {
      x: 1.1,
      y: 1.65,
      w: 6.2,
      h: 0.4,
      fontSize: 15,
      fontFace: 'Arial',
      color: NAVY,
      bold: true
    });

    slide.addText([
      { text: 'The Regulatory Problem:\n', options: { bold: true, color: 'EF4444' } },
      { text: 'Under GST statutory law, tax is payable only once on the provision of services. If past unpaid arrears are taxed again in subsequent invoices, it constitutes illegal compound double taxation.\n\n' },
      { text: 'TeleBill Pro Compliant Ledger Sequence:\n', options: { bold: true, color: BLUE } },
      { text: '1. Current Taxable Base = Base Rental + Unbilled CDR Usage\n' },
      { text: '2. Statutory GST (18%) = Taxable Base × 0.18 (ROUND_HALF_UP)\n' },
      { text: '3. Query Past Delinquent Arrears (from past unpaid invoices)\n' },
      { text: '4. Invoice Grand Total = Taxable Base + 18% GST + Exempt Arrears\n\n', options: { bold: true } },
      { text: 'Auditable Proof:\n', options: { bold: true, color: GREEN } },
      { text: 'Arrears are mathematically isolated from the tax multiplier. When Invoice 2 is created, previous Invoice 1 arrears are transferred without adding a single paisa of extra GST.' }
    ], {
      x: 1.1,
      y: 2.1,
      w: 6.2,
      h: 4.4,
      fontSize: 11,
      fontFace: 'Arial',
      color: TEXT_DARK
    });

    // Right Box: Sample Invoice Breakdown
    slide.addShape(pptx.ShapeType.rect, {
      x: 7.9,
      y: 1.45,
      w: 4.633,
      h: 5.3,
      fill: { color: DARK_SLATE }
    });

    slide.addText('Sample Postpaid Invoice Ledger', {
      x: 8.1,
      y: 1.65,
      w: 4.233,
      h: 0.4,
      fontSize: 14,
      fontFace: 'Arial',
      color: WHITE,
      bold: true
    });

    const ledgerRows = [
      [{ text: 'Line Item', options: { bold: true, color: LIGHT_BLUE } }, { text: 'Amount', options: { bold: true, color: LIGHT_BLUE, align: 'right' } }],
      [{ text: 'Base Rental (POST-STD-299)', options: { color: WHITE } }, { text: 'INR 299.00', options: { color: WHITE, align: 'right' } }],
      [{ text: 'Call Usage (120 min STD)', options: { color: WHITE } }, { text: 'INR 180.00', options: { color: WHITE, align: 'right' } }],
      [{ text: 'Taxable Subtotal', options: { bold: true, color: LIGHT_BLUE } }, { text: 'INR 479.00', options: { bold: true, color: LIGHT_BLUE, align: 'right' } }],
      [{ text: 'Statutory GST (18%)', options: { bold: true, color: GREEN } }, { text: 'INR 86.22', options: { bold: true, color: GREEN, align: 'right' } }],
      [{ text: 'Current Cycle Total', options: { color: WHITE } }, { text: 'INR 565.22', options: { color: WHITE, align: 'right' } }],
      [{ text: 'Delinquent Arrears (Exempt)', options: { bold: true, color: 'F59E0B' } }, { text: 'INR 352.82', options: { bold: true, color: 'F59E0B', align: 'right' } }],
      [{ text: 'NET PAYABLE AMOUNT', options: { bold: true, color: WHITE, fill: { color: BLUE } } }, { text: 'INR 918.04', options: { bold: true, color: WHITE, fill: { color: BLUE }, align: 'right' } }]
    ];

    slide.addTable(ledgerRows, {
      x: 8.1,
      y: 2.2,
      w: 4.233,
      colW: [2.7, 1.533],
      fontSize: 10,
      fontFace: 'Arial',
      border: { pt: 0.5, color: '334155' }
    });

    slide.addText('Generated as scalable vector PDF via streaming PDFKit HTTP response.', {
      x: 8.1,
      y: 5.9,
      w: 4.233,
      h: 0.6,
      fontSize: 10,
      fontFace: 'Arial',
      color: '94A3B8'
    });
  }

  // ==========================================
  // SLIDE 10: Prepaid Real-Time Charging
  // ==========================================
  {
    const slide = pptx.addSlide();
    addSlideChrome(slide, 'Prepaid Lifecycle & Real-Time Balance Charging', 'Prepaid Engine', 10);

    const prepaidCards = [
      {
        title: 'Real-Time Ingestion Rating',
        desc: 'Unlike postpaid batch billing, prepaid accounts must be rated synchronously during call ingestion. The charge is calculated immediately via pulse rules.'
      },
      {
        title: 'Atomic Balance Deduction',
        desc: 'If allowance is zero, balance is debited directly (balance = balance - charge) within a Prisma ACID transaction, preventing overdrafts.'
      },
      {
        title: 'Micro Top-Ups vs Starter Packs',
        desc: 'Starter packs (>= INR 50) bundle 60 free minutes. Micro top-ups (< INR 50) allocate 0 free minutes to enable immediate per-second balance deduction.'
      },
      {
        title: 'Overpayment Wallet Credits',
        desc: 'Surplus payments on settled invoices automatically credit the subscriber prepaid wallet, maintaining positive balances for immediate use.'
      }
    ];

    prepaidCards.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 0.8 + col * 5.95;
      const y = 1.45 + row * 2.65;

      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: 5.75,
        h: 2.45,
        fill: { color: WHITE },
        line: { color: BORDER_COLOR, width: 1 }
      });

      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: 5.75,
        h: 0.45,
        fill: { color: BLUE }
      });

      slide.addText(c.title, {
        x: x + 0.25,
        y: y + 0.1,
        w: 5.25,
        h: 0.3,
        fontSize: 13,
        fontFace: 'Arial',
        color: WHITE,
        bold: true
      });

      slide.addText(c.desc, {
        x: x + 0.25,
        y: y + 0.65,
        w: 5.25,
        h: 1.6,
        fontSize: 12,
        fontFace: 'Arial',
        color: TEXT_DARK
      });
    });
  }

  // ==========================================
  // SLIDE 11: Predictive Billing Algorithm
  // ==========================================
  {
    const slide = pptx.addSlide();
    addSlideChrome(slide, 'Hybrid HWMA Predictive Billing Algorithm', 'Data Science & AI (ADR-006)', 11);

    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 1.45,
      w: 11.733,
      h: 1.4,
      fill: { color: DARK_SLATE }
    });

    slide.addText([
      { text: 'Explainable Time-Series Forecasting Model:\n', options: { bold: true, color: LIGHT_BLUE, fontSize: 13 } },
      { text: 'Combines Holt-Winters Exponential Smoothing on historical cycles with Intra-Cycle Day-by-Day Velocity.\n', options: { color: WHITE, fontSize: 12 } },
      { text: 'Velocity = MTD_Usage / Days_Elapsed   |   Projected_Remaining = Velocity × Days_Remaining', options: { fontFace: 'Courier New', color: 'CBD5E1', fontSize: 12, bold: true } }
    ], {
      x: 1.1,
      y: 1.6,
      w: 11.1,
      h: 1.1,
      fontFace: 'Arial'
    });

    const aiFeatures = [
      {
        title: 'Intra-Cycle Velocity (Burn Rate)',
        desc: 'Measures subscriber calling intensity in the current cycle to project remaining unbilled usage before month-end.'
      },
      {
        title: 'Historical Baseline Smoothing',
        desc: 'Applies Holt-Winters exponential smoothing (α=0.6, β=0.2) to weigh seasonal variations across past cycles.'
      },
      {
        title: 'Explainable AI Decomposition',
        desc: 'Breaks prediction into Base Rental, Accrued Usage, Projected Usage, GST, and Arrears with confidence score.'
      }
    ];

    aiFeatures.forEach((f, idx) => {
      const x = 0.8 + idx * 4.0;
      slide.addShape(pptx.ShapeType.rect, {
        x,
        y: 3.1,
        w: 3.733,
        h: 3.6,
        fill: { color: WHITE },
        line: { color: BORDER_COLOR, width: 1 }
      });

      slide.addText(f.title, {
        x: x + 0.25,
        y: 3.3,
        w: 3.233,
        h: 0.5,
        fontSize: 14,
        fontFace: 'Arial',
        color: NAVY,
        bold: true
      });

      slide.addText(f.desc, {
        x: x + 0.25,
        y: 3.9,
        w: 3.233,
        h: 2.5,
        fontSize: 12,
        fontFace: 'Arial',
        color: TEXT_MUTED
      });
    });
  }

  // ==========================================
  // SLIDE 12: Security Architecture
  // ==========================================
  {
    const slide = pptx.addSlide();
    addSlideChrome(slide, 'Enterprise Security & Anti-IDOR Perimeter', 'Security Architecture (ADR-005)', 12);

    const secCards = [
      {
        title: 'Bcrypt Work Factor 12 Hashing',
        desc: 'All passwords hashed with 4,096 cryptographic rounds. Dummy comparisons neutralize username enumeration timing attacks.'
      },
      {
        title: 'Stateless HS256 JWT Lifecycle',
        desc: 'Digitally signed 60-minute tokens containing user ID, role, and customer ID. Complete zero-dependency verification.'
      },
      {
        title: 'Strict Anti-IDOR Perimeter',
        desc: 'Customer role requests strictly filtered by authenticated customerId. Direct foreign ID references immediately yield HTTP 403.'
      },
      {
        title: 'Audit Logging & Regulatory Trail',
        desc: 'Every administrative mutation, tariff change, and billing run recorded in immutable AuditLog table with IP and payload.'
      }
    ];

    secCards.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 0.8 + col * 5.95;
      const y = 1.45 + row * 2.65;

      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: 5.75,
        h: 2.45,
        fill: { color: WHITE },
        line: { color: BORDER_COLOR, width: 1 }
      });

      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: 0.15,
        h: 2.45,
        fill: { color: GREEN }
      });

      slide.addText(c.title, {
        x: x + 0.35,
        y: y + 0.25,
        w: 5.2,
        h: 0.4,
        fontSize: 15,
        fontFace: 'Arial',
        color: NAVY,
        bold: true
      });

      slide.addText(c.desc, {
        x: x + 0.35,
        y: y + 0.75,
        w: 5.2,
        h: 1.5,
        fontSize: 12,
        fontFace: 'Arial',
        color: TEXT_MUTED
      });
    });
  }

  // ==========================================
  // SLIDE 13: Empirical Test Pyramid
  // ==========================================
  {
    const slide = pptx.addSlide();
    addSlideChrome(slide, 'Empirical Test Pyramid: 232 / 232 Passing Tests', 'Quality Assurance', 13);

    const testTiers = [
      [
        { text: 'Test Hierarchy Level', options: { bold: true, fill: { color: NAVY }, color: WHITE } },
        { text: 'Scope & Target Verification', options: { bold: true, fill: { color: NAVY }, color: WHITE } },
        { text: 'Suites / Cases', options: { bold: true, fill: { color: NAVY }, color: WHITE } },
        { text: 'Pass Rate', options: { bold: true, fill: { color: BLUE }, color: WHITE } }
      ],
      [
        { text: 'Unit Tests', options: { bold: true } },
        { text: 'Pulse Rating math, Allowance deduction, HWMA algorithms, Token signatures' },
        { text: '3 suites, 25 tests' },
        { text: '25 / 25 (100%)', options: { bold: true, color: GREEN } }
      ],
      [
        { text: 'Integration Tests', options: { bold: true } },
        { text: 'Auth endpoints, Billing cycles, CDR ingestion, SQLite WAL 50-worker stress' },
        { text: '4 suites, 89 tests' },
        { text: '89 / 89 (100%)', options: { bold: true, color: GREEN } }
      ],
      [
        { text: 'E2E Tier 1: Coverage', options: { bold: true } },
        { text: 'Happy path customer CRUD, tariff configs, call ingestion, payments' },
        { text: '50 tests' },
        { text: '50 / 50 (100%)', options: { bold: true, color: GREEN } }
      ],
      [
        { text: 'E2E Tier 2: Boundaries', options: { bold: true } },
        { text: 'Duplicate CDR dedup, micro pulses, zero balances, partial & overpayments' },
        { text: '52 tests' },
        { text: '52 / 52 (100%)', options: { bold: true, color: GREEN } }
      ],
      [
        { text: 'E2E Tier 3: Cross-Feature', options: { bold: true } },
        { text: 'Multi-cycle arrears rollover, call barring on suspended accounts, overdue checks' },
        { text: '12 tests' },
        { text: '12 / 12 (100%)', options: { bold: true, color: GREEN } }
      ],
      [
        { text: 'E2E Tier 4: Workloads', options: { bold: true } },
        { text: 'Enterprise multi-subscriber Poisson traffic burst simulation' },
        { text: '4 tests' },
        { text: '4 / 4 (100%)', options: { bold: true, color: GREEN } }
      ],
      [
        { text: 'TOTAL PYRAMID', options: { bold: true, fill: { color: DARK_SLATE }, color: WHITE } },
        { text: 'Comprehensive Opaque-Box In-Process Verification', options: { bold: true, fill: { color: DARK_SLATE }, color: WHITE } },
        { text: '232 Tests', options: { bold: true, fill: { color: DARK_SLATE }, color: WHITE } },
        { text: '232 / 232 (100%)', options: { bold: true, fill: { color: GREEN }, color: WHITE } }
      ]
    ];

    slide.addTable(testTiers, {
      x: 0.8,
      y: 1.45,
      w: 11.733,
      colW: [2.5, 5.0, 2.2, 2.033],
      fontSize: 10,
      fontFace: 'Arial',
      border: { pt: 0.5, color: BORDER_COLOR }
    });

    slide.addText('Executed in 13.5s via master test runner with ZERO 503 swallows or assertion compromises.', {
      x: 0.8,
      y: 6.2,
      w: 11.733,
      h: 0.5,
      fontSize: 12,
      fontFace: 'Arial',
      color: BLUE,
      bold: true,
      align: 'center'
    });
  }

  // ==========================================
  // SLIDE 14: Demonstration Workflow & Web SPA
  // ==========================================
  {
    const slide = pptx.addSlide();
    addSlideChrome(slide, 'Live Demonstration Workflow & Web SPA', 'Product Demonstration', 14);

    const demoSteps = [
      {
        num: '1',
        title: '1-Click Role Switcher',
        desc: 'Instantly toggle between Admin, Operator, and Customer perspectives without re-typing passwords.'
      },
      {
        num: '2',
        title: 'Dynamic Telemetry',
        desc: 'Live KPI metric cards, revenue area charts, and call traffic doughnuts rendered via Chart.js.'
      },
      {
        num: '3',
        title: 'Poisson Call Generator',
        desc: 'Interactive modal to generate synthetic Poisson call bursts and inspect SHA-256 deduplication live.'
      },
      {
        num: '4',
        title: 'Batch Billing & PDF',
        desc: 'Execute monthly postpaid billing run, view itemized tax ledger, and download vector PDF invoices.'
      },
      {
        num: '5',
        title: 'Payment Gateway',
        desc: 'Simulate credit card, UPI, or net-banking payments with real-time invoice status transitions.'
      },
      {
        num: '6',
        title: 'Predictive Dashboard',
        desc: 'Customer self-service portal featuring explainable HWMA predictive bill forecast and burn rate.'
      }
    ];

    demoSteps.forEach((d, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = 0.8 + col * 4.0;
      const y = 1.45 + row * 2.65;

      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: 3.733,
        h: 2.45,
        fill: { color: WHITE },
        line: { color: BORDER_COLOR, width: 1 }
      });

      slide.addShape(pptx.ShapeType.ellipse, {
        x: x + 0.25,
        y: y + 0.25,
        w: 0.5,
        h: 0.5,
        fill: { color: BLUE }
      });

      slide.addText(d.num, {
        x: x + 0.25,
        y: y + 0.3,
        w: 0.5,
        h: 0.4,
        fontSize: 12,
        fontFace: 'Arial',
        color: WHITE,
        bold: true,
        align: 'center'
      });

      slide.addText(d.title, {
        x: x + 0.9,
        y: y + 0.25,
        w: 2.6,
        h: 0.45,
        fontSize: 13,
        fontFace: 'Arial',
        color: NAVY,
        bold: true
      });

      slide.addText(d.desc, {
        x: x + 0.25,
        y: y + 0.85,
        w: 3.233,
        h: 1.4,
        fontSize: 11,
        fontFace: 'Arial',
        color: TEXT_MUTED
      });
    });
  }

  // ==========================================
  // SLIDE 15: Conclusion & Defense Summary
  // ==========================================
  {
    const slide = pptx.addSlide();
    slide.background = { color: NAVY };

    slide.addText('CONCLUSION & VIVA DEFENSE SUMMARY', {
      x: 1.0,
      y: 0.8,
      w: 11.3,
      h: 0.6,
      fontSize: 26,
      fontFace: 'Arial',
      color: WHITE,
      bold: true
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 1.0,
      y: 1.5,
      w: 11.3,
      h: 0.08,
      fill: { color: BLUE }
    });

    const summaryPoints = [
      {
        bold: 'Commercial-Grade Engineering: ',
        text: 'Replaced fragile open-source reference patterns with a modular, high-integrity TypeScript/Node.js monolith.'
      },
      {
        bold: 'Zero Financial Drift: ',
        text: 'Fixed-point Decimal.js arithmetic ensures exact mathematical precision across millions of call pulses and tax ledgers.'
      },
      {
        bold: 'Cryptographic Deduplication: ',
        text: 'SHA-256 fingerprinting guarantees zero double-billing even under network switch retransmissions.'
      },
      {
        bold: 'Statutory GST Compliance: ',
        text: 'Delinquent arrears are strictly isolated from tax multipliers, eliminating illegal compound double taxation.'
      },
      {
        bold: '100% Empirical Verification: ',
        text: '232 / 232 automated tests passing across all unit, integration, and end-to-end tiers.'
      }
    ];

    summaryPoints.forEach((pt, idx) => {
      const y = 1.8 + idx * 0.95;
      slide.addShape(pptx.ShapeType.rect, {
        x: 1.0,
        y,
        w: 11.3,
        h: 0.8,
        fill: { color: DARK_SLATE },
        line: { color: '334155', width: 1 }
      });

      slide.addText([
        { text: `✓  ${pt.bold}`, options: { bold: true, color: LIGHT_BLUE, fontSize: 13 } },
        { text: pt.text, options: { color: WHITE, fontSize: 13 } }
      ], {
        x: 1.2,
        y: y + 0.15,
        w: 10.9,
        h: 0.5,
        fontFace: 'Arial'
      });
    });

    slide.addText('Ready for Viva Voce Q&A and Live System Demonstration', {
      x: 1.0,
      y: 6.6,
      w: 11.3,
      h: 0.5,
      fontSize: 14,
      fontFace: 'Arial',
      color: GREEN,
      bold: true,
      align: 'center'
    });
  }

  const outputPath = path.resolve(process.cwd(), 'docs', 'telebill-pro-presentation.pptx');
  await pptx.writeFile({ fileName: outputPath });
  console.log(`Successfully generated PowerPoint presentation at: ${outputPath}`);
}

generatePresentation().catch(err => {
  console.error('Failed to generate presentation:', err);
  process.exit(1);
});
