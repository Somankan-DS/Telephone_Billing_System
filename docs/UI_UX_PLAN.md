# TeleBill Pro — UI/UX Design System & Experience Architecture

## 1. Design Philosophy

TeleBill Pro is designed with the aesthetic, interaction design, and operational polish of a **commercial enterprise SaaS application** rather than a generic student dashboard template. 

The user interface prioritizes:
1. **High Information Density with Visual Clarity:** Immediate visibility of critical telecom metrics (collections, unbilled usage, arrears, active pulses) without cognitive overload.
2. **Context-Driven Role Adaptability:** Dual-persona experience tailoring administrative operations (CRM 360, CDR simulations, billing runs) for operators while presenting a simplified, consumer-friendly self-service portal for subscribers.
3. **Instantaneous Demonstration Convenience:** 1-Click demo role switcher pills, pre-filled operational modals, and live chart animations allowing a college presenter to effortlessly demonstrate complex billing concepts during an academic viva.

---

## 2. Typography & Font System

| Hierarchy Role | Font Family | Weight / Style | Purpose & Application |
| :--- | :--- | :--- | :--- |
| **Primary Interface Text** | Inter, -apple-system, sans-serif | Regular (400), Medium (500), Bold (700) | Headings, navigation labels, body text, form inputs, modal dialogs. |
| **Numeric & Code Data** | JetBrains Mono, monospace | Medium (500), Bold (700) | Monetary figures (INR), phone MSISDNs, invoice IDs, pulse seconds, SHA-256 hashes. |

---

## 3. Color Palette & Semantic State System

```
Slate-950   #020617  [Sidebar brand background, high-contrast dark accents]
Slate-900   #0f172a  [Navigation sidebar background, modal overlay backdrop]
Slate-50    #f8fafc  [Application background canvas, table header fill]
Indigo-600  #4f46e5  [Primary brand action, active tab pill, focused input border]
Emerald-600 #059669  [Settled payments, active accounts, completed calls, collections]
Amber-500   #d97706  [Suspended accounts, pending bills, aging receivables, warnings]
Rose-600    #e11d48  [Overdue debt, barred calls, gateway declines, unread critical alerts]
```

### Semantic Status Badges
- **ACTIVE / PAID:** `.badge-active`, `.badge-paid` — Soft emerald pill (`bg-emerald-100 text-emerald-800 font-bold`).
- **SUSPENDED / PARTIALLY_PAID:** `.badge-suspended`, `.badge-partial` — Soft amber/blue pill (`bg-amber-100 text-amber-800`).
- **OVERDUE:** `.badge-overdue` — Soft rose pill with pulsing CSS animation (`bg-red-100 text-red-800 animate-pulse`).
- **INACTIVE / CANCELLED:** `.badge-inactive` — Neutral slate pill (`bg-slate-100 text-slate-700`).

---

## 4. Component Design Specifications

### A. Executive KPI Cards
- Crisp white rounded card (`rounded-xl border border-slate-200 shadow-sm`).
- Top row: Semantic metric label with Lucide icon in subtle accent color.
- Middle row: Hero value formatted in bold typography (`text-2xl font-bold text-slate-900`).
- Bottom row: Micro-caption showing contextual movement (e.g. "Active accounts", "Realized Collections").

### B. High-Density Data Tables
- Sticky light-slate header (`bg-slate-50 uppercase text-[11px] font-semibold tracking-wider text-slate-500`).
- Alternating hover row highlights (`hover:bg-slate-50 transition`).
- Right-aligned monetary values and numeric pulse metrics.
- Action column with icon pills (PDF download, customer status toggle, payment trigger).

### C. Subscriber Allowance Quota Visual Meters
- Clean vertical stack displaying remaining allowance minutes for Local, STD, and ISD calls.
- Top label shows explicit numerical fraction: `500 / 500 mins` (Mono font).
- Progress bar container (`h-2.5 rounded-full bg-slate-100 overflow-hidden`).
- Colored fill bar (`bg-indigo-600` for Local, `bg-blue-500` for STD, `bg-amber-500` for ISD) scaling dynamically via percentage inline width.

### D. Interactive Modal Dialogs
- Backdrop overlay using subtle CSS blur (`backdrop-blur-sm bg-slate-900/60`).
- Centered card container (`rounded-2xl shadow-2xl max-w-md / max-w-lg`).
- Accessible header with title and close icon button.
- Clean form fields with 11px bold labels and subtle focus rings (`focus:ring-2 focus:ring-indigo-500/20`).

### E. Responsive Toast System
- Positioned in bottom-right viewport (`fixed bottom-5 right-5 z-50`).
- Lightweight pill layout with smooth sliding entry (`translate-y-2 opacity-0` -> `translate-y-0 opacity-100`).
- Auto-dismissing timer (3.5 seconds).

---

## 5. Responsive Grid Breakpoints

- **Desktop (1024px+):** Full 64px width persistent navigation sidebar, 5-column KPI grid, 2-to-1 chart grid ratio.
- **Tablet (768px - 1023px):** 2-column or 3-column KPI card wrap, full-width charts, scrollable table containers.
- **Mobile (< 768px):** Collapsible sidebar, single-column KPI stack, touch-optimized button hit targets (min 44px height).
