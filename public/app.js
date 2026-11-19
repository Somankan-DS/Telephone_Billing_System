/**
 * TeleBill Pro — Client-Side Application Engine
 * Interactive SPA communicating with Express + Prisma SQLite WAL Backend
 */

// Application State
const state = {
  token: localStorage.getItem('telebill_token') || null,
  user: JSON.parse(localStorage.getItem('telebill_user') || 'null'),
  activeTab: 'dashboard',
  charts: {},
  cachedCustomers: [],
  cachedPlans: [],
  cachedInvoices: [],
};

// API Base URL
const API_BASE = '/api';

// Initialize Lucide icons on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  initSidebarState();

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Auto-login as Admin if no session exists for immediate demo convenience
  if (!state.token || !state.user) {
    await quickLogin('admin');
  } else {
    updateUserUI();
    await refreshActiveTab();
  }

  // Preload plans into Add Customer modal dropdown immediately
  ensurePlansLoaded();

  // Periodic notifications check
  setInterval(loadNotifications, 30000);
});

// =========================================================================
// API HELPER WITH JWT AUTH
// =========================================================================

async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      let errorMsg = data.message;
      if (!errorMsg && typeof data.error === 'string') errorMsg = data.error;
      else if (!errorMsg && data.error && typeof data.error.message === 'string') errorMsg = data.error.message;
      else if (!errorMsg) errorMsg = `HTTP ${res.status}: Request failed`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    showToast(err.message || 'API request error', 'error');
    throw err;
  }
}

// =========================================================================
// AUTHENTICATION & DEMO SWITCHER
// =========================================================================

async function quickLogin(role) {
  let identifier = 'admin@telebill.local';
  let password = 'Admin@123456';

  if (role === 'staff' || role === 'operator') {
    identifier = 'operator@telebill.local';
    password = 'Operator@123456';
  } else if (role === 'customer') {
    identifier = 'customer@telebill.local';
    password = 'Customer@123456';
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      let errorMsg = data.message;
      if (!errorMsg && typeof data.error === 'string') errorMsg = data.error;
      else if (!errorMsg && data.error && typeof data.error.message === 'string') errorMsg = data.error.message;
      else if (!errorMsg) errorMsg = `Login failed (${res.status})`;
      throw new Error(errorMsg);
    }

    state.token = data.token || data.data?.token;
    state.user = data.user || data.data?.user;

    localStorage.setItem('telebill_token', state.token);
    localStorage.setItem('telebill_user', JSON.stringify(state.user));

    updateUserUI();
    showToast(`Logged in as ${state.user.role}: ${state.user.email}`, 'success');

    // Route customer directly to Customer Portal
    if (state.user.role === 'CUSTOMER') {
      switchTab('customer-portal');
    } else {
      switchTab('dashboard');
    }
  } catch (err) {
    showToast(`Login failed: ${err.message}`, 'error');
  }
}

function updateUserUI() {
  if (!state.user) return;

  const nameEl = document.getElementById('user-name');
  const roleEl = document.getElementById('user-role-badge');
  const avatarEl = document.getElementById('user-avatar');

  if (nameEl) nameEl.textContent = state.user.email.split('@')[0];
  if (roleEl) roleEl.textContent = state.user.role;
  if (avatarEl) avatarEl.textContent = state.user.role.substring(0, 2);

  // Update switcher buttons appearance
  const btnAdmin = document.getElementById('btn-role-admin');
  const btnStaff = document.getElementById('btn-role-staff');
  const btnCustomer = document.getElementById('btn-role-customer');

  if (btnAdmin) btnAdmin.className = state.user.role === 'ADMIN' ? 'role-toggle-btn active' : 'role-toggle-btn';
  if (btnStaff) btnStaff.className = state.user.role === 'STAFF' ? 'role-toggle-btn active' : 'role-toggle-btn';
  if (btnCustomer) btnCustomer.className = state.user.role === 'CUSTOMER' ? 'role-toggle-btn active' : 'role-toggle-btn';

  // Toggle role-based sidebar sections
  const adminSection = document.getElementById('admin-sidebar-section');
  const customerSection = document.getElementById('customer-sidebar-section');
  const isStaffOrAdmin = state.user.role === 'ADMIN' || state.user.role === 'STAFF';
  const isAdmin = state.user.role === 'ADMIN';

  if (adminSection) adminSection.style.display = isStaffOrAdmin ? 'block' : 'none';
  if (customerSection) customerSection.style.display = !isStaffOrAdmin ? 'block' : 'none';

  const sidebarTitle = document.getElementById('admin-sidebar-title');
  if (sidebarTitle) {
    sidebarTitle.textContent = isAdmin ? 'OPERATIONS (ADMIN)' : 'OPERATIONS (OPERATOR)';
  }

  // --- Strict RBAC Controls (Admin vs Operator) ---
  // 1. Tariff Plan Creation (Admin Only)
  const btnCreateTariff = document.getElementById('btn-create-tariff');
  const badgeTariffReadOnly = document.getElementById('badge-tariff-readonly');
  if (btnCreateTariff) btnCreateTariff.style.display = isAdmin ? 'inline-flex' : 'none';
  if (badgeTariffReadOnly) badgeTariffReadOnly.style.display = !isAdmin ? 'inline-flex' : 'none';

  // 2. Traffic Simulator Actions (Admin Only)
  const btnHubSimulate = document.getElementById('btn-hub-simulate');
  const btnCdrSimulate = document.getElementById('btn-cdr-simulate');
  if (btnHubSimulate) btnHubSimulate.style.display = isAdmin ? 'inline-flex' : 'none';
  if (btnCdrSimulate) btnCdrSimulate.style.display = isAdmin ? 'inline-flex' : 'none';

  // 3. Billing Run Execution (Admin Only)
  const btnHubBilling = document.getElementById('btn-hub-billing');
  const btnBillingRun = document.getElementById('btn-billing-run');
  const btnBillingCheckOverdue = document.getElementById('btn-billing-check-overdue');
  const badgeBillingReadOnly = document.getElementById('badge-billing-readonly');
  if (btnHubBilling) btnHubBilling.style.display = isAdmin ? 'inline-flex' : 'none';
  if (btnBillingRun) btnBillingRun.style.display = isAdmin ? 'inline-flex' : 'none';
  if (btnBillingCheckOverdue) btnBillingCheckOverdue.style.display = isAdmin ? 'inline-flex' : 'none';
  if (badgeBillingReadOnly) badgeBillingReadOnly.style.display = !isAdmin ? 'inline-flex' : 'none';

  // 4. Reset Demo Data Button (Admin Only)
  const btnResetDemo = document.getElementById('btn-reset-demo');
  if (btnResetDemo) btnResetDemo.style.display = isAdmin ? 'inline-flex' : 'none';

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  loadNotifications();
}

async function confirmResetDemo() {
  if (state.user?.role !== 'ADMIN') {
    showToast('Only Admin can reset benchmark data', 'error');
    return;
  }
  const confirmed = confirm(
    'Are you sure you want to reset all data back to the clean benchmark state?\n\nThis will clear all generated test calls, monthly bills, and payment records.'
  );
  if (!confirmed) return;

  const btn = document.getElementById('btn-reset-demo');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Resetting...';
  }

  try {
    const res = await api('/admin/reset-database', { method: 'POST' });
    showToast(res.message || 'Database reset to clean benchmark state!', 'success');
    await refreshActiveTab();
  } catch (err) {
    showToast(`Reset failed: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="rotate-ccw" style="width:14px;height:14px;margin-right:6px;"></i> Reset Demo Data';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('telebill_token');
  localStorage.removeItem('telebill_user');
  quickLogin('admin');
}

// =========================================================================
// TAB SWITCHING & ROUTING
// =========================================================================

async function switchTab(tabId) {
  state.activeTab = tabId;

  // Update sidebar active styling
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`nav-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Update views
  document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.remove('active'));
  const targetPane = document.getElementById(`tab-${tabId}`);
  if (targetPane) targetPane.classList.add('active');

  // Update title
  const titles = {
    dashboard: 'Executive Dashboard & Live KPIs',
    customers: 'Customer 360 & Account Management',
    tariffs: 'Tariff Plans & Rating Engine Configuration',
    cdr: 'Call Detail Records (CDR) & Traffic Simulator',
    billing: 'Monthly Billing Cycles & Tax Invoices',
    payments: 'Simulated Payment Gateway & Settlement',
    'customer-portal': 'Subscriber Self-Service Portal',
    prediction: 'Smart Bill Prediction Engine (Hybrid HWMA)',
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[tabId] || 'TeleBill Pro';

  // Load content
  await refreshActiveTab();

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

async function refreshActiveTab() {
  switch (state.activeTab) {
    case 'dashboard':
      await loadDashboardData();
      break;
    case 'customers':
      await loadCustomers();
      break;
    case 'tariffs':
      await loadTariffs();
      break;
    case 'cdr':
      await loadCdrs();
      break;
    case 'billing':
      await loadInvoices();
      break;
    case 'payments':
      await loadPayments();
      break;
    case 'customer-portal':
      await loadCustomerPortal();
      break;
    case 'prediction':
      await loadPrediction();
      break;
  }
}

// =========================================================================
// TAB 1: DASHBOARD
// =========================================================================

async function loadDashboardData() {
  try {
    const statsRes = await api('/admin/dashboard/stats');
    const stats = statsRes.data || statsRes;

    document.getElementById('kpi-total-customers').textContent = stats.totalCustomers ?? '0';
    document.getElementById('kpi-active-customers').textContent = `${stats.activeCustomers ?? '0'} Active`;
    document.getElementById('kpi-total-revenue').textContent = `₹${parseFloat(stats.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('kpi-total-billed').textContent = `₹${parseFloat(stats.totalBilled || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('kpi-outstanding').textContent = `₹${parseFloat(stats.outstandingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('kpi-total-calls').textContent = stats.totalCallsRated ?? stats.totalCalls ?? '0';

    // Revenue Trends Chart
    const revRes = await api('/admin/dashboard/revenue-trends');
    const revData = revRes.data || revRes;
    renderRevenueChart(revData.trends || revData.data || []);

    // Call Distribution Chart
    const distRes = await api('/admin/dashboard/call-distribution');
    const distData = distRes.breakdown || distRes.data?.breakdown || distRes;
    renderTrafficMixChart(distData);

    // Recent Payments
    const payRes = await api('/payments?limit=5');
    const payments = payRes.data || payRes.payments || [];
    renderRecentPayments(payments);
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

function renderRevenueChart(trends) {
  const ctx = document.getElementById('chart-revenue-trend')?.getContext('2d');
  if (!ctx) return;

  if (state.charts.revenue) {
    state.charts.revenue.destroy();
  }

  const labels = trends.map((t) => t.cycle || t.month || 'Cycle');
  const billedData = trends.map((t) => parseFloat(t.totalBilled || t.billed || 0));
  const paidData = trends.map((t) => parseFloat(t.totalPaid || t.collected || 0));

  state.charts.revenue = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['2026-09', '2026-10', '2026-11'],
      datasets: [
        {
          label: 'Total Billed (₹)',
          data: billedData.length ? billedData : [1250, 1850, 2400],
          backgroundColor: '#1A3C2B',
          borderRadius: 2,
        },
        {
          label: 'Collections Realized (₹)',
          data: paidData.length ? paidData : [1100, 1600, 2100],
          backgroundColor: '#10b981',
          borderRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'JetBrains Mono', size: 10 } } },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(58, 58, 56, 0.10)' }, ticks: { font: { family: 'JetBrains Mono', size: 9 } } },
        x: { grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 9 } } },
      },
    },
  });
}

function renderTrafficMixChart(breakdown) {
  const ctx = document.getElementById('chart-traffic-mix')?.getContext('2d');
  if (!ctx) return;

  if (state.charts.traffic) {
    state.charts.traffic.destroy();
  }

  const local = breakdown.LOCAL?.count || 12;
  const std = breakdown.STD?.count || 5;
  const isd = breakdown.ISD?.count || 2;

  state.charts.traffic = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Local Calls', 'STD National', 'ISD International'],
      datasets: [
        {
          data: [local, std, isd],
          backgroundColor: ['#1A3C2B', '#FF8C69', '#F4D35E'],
          borderColor: '#FFFFFF',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { family: 'JetBrains Mono', size: 10 } } },
      },
      cutout: '70%',
    },
  });
}

function renderRecentPayments(payments) {
  const tbody = document.getElementById('dashboard-recent-payments');
  if (!tbody) return;

  if (!payments || payments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-slate-400">No recent transactions</td></tr>';
    return;
  }

  tbody.innerHTML = payments
    .map(
      (p) => `
    <tr class="hover:bg-slate-50 transition">
      <td class="px-6 py-3 font-mono font-medium text-slate-900">${p.paymentNumber || p.payment_number || p.id}</td>
      <td class="px-6 py-3">${p.customer?.firstName || ''} ${p.customer?.lastName || 'Customer'}</td>
      <td class="px-6 py-3 font-mono text-slate-500">${p.invoice?.invoiceNumber || p.invoiceId || 'Wallet Top-Up'}</td>
      <td class="px-6 py-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">${p.paymentMethod || p.payment_method}</span></td>
      <td class="px-6 py-3 font-bold text-slate-900">₹${parseFloat(p.amount || 0).toFixed(2)}</td>
      <td class="px-6 py-3"><span class="badge-paid">${p.status}</span></td>
      <td class="px-6 py-3 text-slate-400 text-[11px]">${new Date(p.createdAt || p.paidAt || Date.now()).toLocaleDateString()}</td>
    </tr>
  `
    )
    .join('');
}

// =========================================================================
// TAB 2: CUSTOMERS (CRM 360)
// =========================================================================

async function loadCustomers() {
  const search = document.getElementById('cust-search')?.value || '';
  const status = document.getElementById('cust-status-filter')?.value || '';

  try {
    let url = `/customers?limit=15&search=${encodeURIComponent(search)}`;
    if (status) url += `&status=${status}`;

    const res = await api(url);
    const customers = Array.isArray(res.data) ? res.data : (res.customers || res.data?.customers || []);
    state.cachedCustomers = customers;

    const tbody = document.getElementById('customers-table-body');
    if (!tbody) return;

    if (customers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-slate-400">No customers found</td></tr>';
      return;
    }

    tbody.innerHTML = customers
      .map((c) => {
        const statusBadge =
          c.status === 'ACTIVE'
            ? 'badge-active'
            : c.status === 'SUSPENDED'
            ? 'badge-suspended'
            : 'badge-inactive';

        return `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-6 py-3.5 font-mono font-semibold text-slate-900">${c.accountNumber}</td>
        <td class="px-6 py-3.5">
          <p class="font-bold text-slate-900">${c.firstName} ${c.lastName}</p>
          <p class="text-[11px] text-slate-400">${c.email || c.user?.email || ''}</p>
        </td>
        <td class="px-6 py-3.5 font-mono text-slate-700">${c.phone}</td>
        <td class="px-6 py-3.5">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700">
            ${c.tariffPlan?.name || 'Standard'}
          </span>
        </td>
        <td class="px-6 py-3.5">
          <p class="font-bold text-slate-800">Bal: ₹${parseFloat(c.prepaidBalance || 0).toFixed(2)}</p>
          <p class="text-[10px] text-slate-400">Limit: ₹${parseFloat(c.creditLimit || 0).toFixed(2)}</p>
        </td>
        <td class="px-6 py-3.5"><span class="${statusBadge}">${c.status}</span></td>
        <td class="px-6 py-3.5 text-right space-x-1">
          <button onclick="toggleCustomerStatus('${c.id}', '${c.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'}')" class="p-1 hover:text-indigo-600 transition" title="Toggle Status">
            <i data-lucide="${c.status === 'ACTIVE' ? 'pause-circle' : 'play-circle'}" class="w-4 h-4 inline"></i>
          </button>
        </td>
      </tr>
    `;
      })
      .join('');

    populateCustomerDropdowns(customers);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    console.error('Failed to load customers:', err);
  }
}

async function toggleCustomerStatus(customerId, newStatus) {
  try {
    await api(`/customers/${customerId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    showToast(`Customer status updated to ${newStatus}`, 'success');
    await loadCustomers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function populateCustomerDropdowns(customers) {
  const simSelect = document.getElementById('sim-customer-select');
  const billSelect = document.getElementById('billing-customer-select');

  const options = customers
    .map((c) => `<option value="${c.id}">${c.firstName} ${c.lastName} (${c.phone}) [${c.tariffPlan?.name || ''}]</option>`)
    .join('');

  if (simSelect) {
    simSelect.innerHTML = `<option value="">All Active Customers (Distributed)</option>${options}`;
  }
  if (billSelect) {
    billSelect.innerHTML = `<option value="">All Active Postpaid Customers</option>${options}`;
  }
}

// =========================================================================
// TAB 3: TARIFF PLANS
// =========================================================================

async function loadTariffs() {
  try {
    const res = await api('/tariffs');
    const plans = Array.isArray(res.data) ? res.data : (res.plans || res.data?.plans || []);
    state.cachedPlans = plans;

    const grid = document.getElementById('tariff-cards-grid');
    if (!grid) return;

    grid.className = 'tariff-grid';
    grid.removeAttribute('style');

    grid.innerHTML = plans
      .map(
        (p) => `
      <div class="tariff-card">
        <div>
          <div class="tariff-card-header">
            <div class="tariff-card-badges">
              <span class="tariff-type-badge ${p.type === 'PREPAID' ? 'tariff-type-prepaid' : 'tariff-type-postpaid'}">
                ${p.type}
              </span>
              <span class="tariff-code-pill">${p.planCode}</span>
            </div>
            <h3 class="tariff-card-title">${p.name}</h3>
            <p class="tariff-card-desc">${p.description || 'Configurable telecom plan with rating rules.'}</p>
          </div>

          <div class="tariff-card-price-strip">
            <div>
              <span class="tariff-price-amount">₹${parseFloat(p.monthlyRental || 0).toFixed(2)}</span>
            </div>
            <span class="tariff-price-period">${p.type === 'PREPAID' ? 'Per 28 Days' : 'Monthly Rental'}</span>
          </div>

          <div class="tariff-card-body">
            <div class="tariff-rates-list">
              <div class="tariff-rate-row">
                <span class="tariff-rate-label">Pulse Increment</span>
                <span class="tariff-pulse-badge">${p.pulseSeconds}s pulse</span>
              </div>
              <div class="tariff-rate-row">
                <span class="tariff-rate-label">Local Call Rate</span>
                <span class="tariff-rate-val">₹${parseFloat(p.rateLocal || 0).toFixed(4)} / min</span>
              </div>
              <div class="tariff-rate-row">
                <span class="tariff-rate-label">STD National Rate</span>
                <span class="tariff-rate-val">₹${parseFloat(p.rateStd || 0).toFixed(4)} / min</span>
              </div>
              <div class="tariff-rate-row">
                <span class="tariff-rate-label">ISD International Rate</span>
                <span class="tariff-rate-val">₹${parseFloat(p.rateIsd || 0).toFixed(4)} / min</span>
              </div>
            </div>
          </div>
        </div>

        <div class="tariff-card-footer">
          <div class="tariff-quota-item">
            <span>Free Local:</span>
            <strong class="tariff-quota-val">${p.includedLocalMinutes || 0} min</strong>
          </div>
          <div class="tariff-quota-item">
            <span>STD Quota:</span>
            <strong class="tariff-quota-val">${p.includedStdMinutes || 0} min</strong>
          </div>
        </div>
      </div>
    `
      )
      .join('');

    // Populate plan select in Add Customer modal
    const planSelect = document.getElementById('customer-plan-select');
    if (planSelect) {
      planSelect.innerHTML = plans.map((p) => `<option value="${p.id}">${p.name} [${p.planCode}] (${p.type})</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load tariffs:', err);
  }
}

// =========================================================================
// TAB 4: CDR & TRAFFIC SIMULATOR
// =========================================================================

async function loadCdrs() {
  try {
    const res = await api('/cdrs?limit=20');
    const cdrs = Array.isArray(res.data) ? res.data : (res.cdrs || res.data?.cdrs || []);

    const tbody = document.getElementById('cdr-table-body');
    if (!tbody) return;

    if (cdrs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-slate-400">No call records found. Use the Poisson Simulator to generate traffic.</td></tr>';
      return;
    }

    tbody.innerHTML = cdrs
      .map(
        (c) => `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-6 py-3 font-mono font-medium text-slate-900">${c.sourceCallId || c.source_call_id || c.id}</td>
        <td class="px-6 py-3 font-mono text-slate-700">${c.callerNumber || c.caller_msisdn}</td>
        <td class="px-6 py-3 font-mono text-slate-700">${c.receiverNumber || c.receiver_msisdn}</td>
        <td class="px-6 py-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">${c.callType || c.call_type}</span></td>
        <td class="px-6 py-3 font-mono">${c.durationSeconds}s (${c.pulseCount || 1}p)</td>
        <td class="px-6 py-3 font-mono text-slate-500">${parseFloat(c.freeMinutesDeducted || 0).toFixed(2)}m</td>
        <td class="px-6 py-3 font-bold text-slate-900">₹${parseFloat(c.ratedAmount || 0).toFixed(2)}</td>
        <td class="px-6 py-3"><span class="badge-active">${c.status}</span></td>
        <td class="px-6 py-3 text-slate-400 text-[11px]">${new Date(c.startTime || Date.now()).toLocaleTimeString()}</td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    console.error('Failed to load CDRs:', err);
  }
}

// =========================================================================
// TAB 5: BILLING & INVOICES
// =========================================================================

async function loadInvoices() {
  try {
    const res = await api('/invoices?limit=20');
    const invoices = Array.isArray(res.data) ? res.data : (res.invoices || res.data?.invoices || []);
    state.cachedInvoices = invoices;

    const tbody = document.getElementById('invoices-table-body');
    if (!tbody) return;

    if (invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-4 text-center text-slate-400">No invoices generated yet. Click "Run Billing Cycle" to generate bills.</td></tr>';
      return;
    }

    tbody.innerHTML = invoices
      .map((inv) => {
        const badge =
          inv.status === 'PAID'
            ? 'badge-paid'
            : inv.status === 'OVERDUE'
            ? 'badge-overdue'
            : inv.status === 'PARTIALLY_PAID'
            ? 'badge-partial'
            : 'badge-unpaid';

        return `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-6 py-3.5 font-mono font-bold text-slate-900">${inv.invoiceNumber}</td>
        <td class="px-6 py-3.5">
          <p class="font-medium text-slate-900">${inv.customer?.firstName || ''} ${inv.customer?.lastName || 'Customer'}</p>
          <p class="text-[10px] text-slate-400 font-mono">${inv.customer?.accountNumber || ''}</p>
        </td>
        <td class="px-6 py-3.5 font-mono text-slate-700">${inv.billingCycleCode}</td>
        <td class="px-6 py-3.5 font-mono">₹${parseFloat(inv.rentalAmount || 0).toFixed(2)}</td>
        <td class="px-6 py-3.5 font-mono">₹${parseFloat(inv.callCharges || 0).toFixed(2)}</td>
        <td class="px-6 py-3.5 font-mono text-slate-500">₹${parseFloat(inv.taxAmount || 0).toFixed(2)}</td>
        <td class="px-6 py-3.5 font-mono text-amber-600">₹${parseFloat(inv.previousArrears || 0).toFixed(2)}</td>
        <td class="px-6 py-3.5 font-bold text-slate-900 text-sm">₹${parseFloat(inv.totalAmount || 0).toFixed(2)}</td>
        <td class="px-6 py-3.5"><span class="${badge}">${inv.status}</span></td>
        <td class="px-6 py-3.5 text-right space-x-1">
          <a href="${API_BASE}/invoices/${inv.id}/pdf" target="_blank" class="btn-secondary py-1 px-2 text-[11px]" title="Download PDF Invoice">
            <i data-lucide="download" class="w-3.5 h-3.5 mr-1 inline"></i> PDF
          </a>
        </td>
      </tr>
    `;
      })
      .join('');

    populateInvoiceDropdowns(invoices);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    console.error('Failed to load invoices:', err);
  }
}

function populateInvoiceDropdowns(invoices) {
  const invSelect = document.getElementById('payment-invoice-select');
  if (!invSelect) return;

  const unpaid = invoices.filter((i) => i.status !== 'PAID');
  const options = unpaid
    .map(
      (i) =>
        `<option value="${i.id}" data-amount="${i.totalAmount}">${i.invoiceNumber} - ${i.customer?.firstName} ${i.customer?.lastName} (Due: ₹${i.totalAmount})</option>`
    )
    .join('');

  invSelect.innerHTML = `<option value="">Direct Wallet Recharge (No Invoice)</option>${options}`;
  invSelect.onchange = (e) => {
    const selected = invSelect.options[invSelect.selectedIndex];
    const amount = selected.getAttribute('data-amount');
    if (amount) {
      document.getElementById('payment-amount-input').value = parseFloat(amount).toFixed(2);
    }
  };
}

async function checkOverdueBills() {
  try {
    const res = await api('/billing/check-overdue', { method: 'POST' });
    showToast(res.message || 'Overdue check completed and alerts generated', 'success');
    await loadInvoices();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =========================================================================
// TAB 6: PAYMENTS
// =========================================================================

async function loadPayments() {
  try {
    const res = await api('/payments?limit=25');
    const payments = Array.isArray(res.data) ? res.data : (res.payments || res.data?.payments || []);

    const tbody = document.getElementById('payments-table-body');
    if (!tbody) return;

    if (payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-slate-400">No payment records found</td></tr>';
      return;
    }

    tbody.innerHTML = payments
      .map(
        (p) => `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-6 py-3 font-mono font-medium text-slate-900">${p.paymentNumber}</td>
        <td class="px-6 py-3 font-mono text-slate-500 text-[11px]">${p.transactionRef}</td>
        <td class="px-6 py-3 font-medium">${p.customer?.firstName || ''} ${p.customer?.lastName || 'Customer'}</td>
        <td class="px-6 py-3 font-mono text-slate-600">${p.invoice?.invoiceNumber || 'Prepaid Wallet Top-Up'}</td>
        <td class="px-6 py-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">${p.paymentMethod}</span></td>
        <td class="px-6 py-3 font-bold text-slate-900">₹${parseFloat(p.amount || 0).toFixed(2)}</td>
        <td class="px-6 py-3"><span class="badge-paid">${p.status}</span></td>
        <td class="px-6 py-3 text-slate-400 text-[11px]">${new Date(p.createdAt || p.paidAt || Date.now()).toLocaleString()}</td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    console.error('Failed to load payments:', err);
  }
}

// =========================================================================
// TAB 7: REPORTS & AGING
// =========================================================================

async function loadReports() {
  try {
    const res = await api('/reports/aging-receivables');
    const aging = res.data || res;

    const container = document.getElementById('aging-buckets-container');
    if (container) {
      const buckets = [
        { label: 'Current (0 - 30 Days)', count: aging.current?.count || 0, amount: aging.current?.amount || 0, color: 'bg-emerald-500' },
        { label: 'Past Due (31 - 60 Days)', count: aging.days30?.count || 0, amount: aging.days30?.amount || 0, color: 'bg-blue-500' },
        { label: 'Delinquent (61 - 90 Days)', count: aging.days60?.count || 0, amount: aging.days60?.amount || 0, color: 'bg-amber-500' },
        { label: 'Critical Default (90+ Days)', count: aging.days90Plus?.count || 0, amount: aging.days90Plus?.amount || 0, color: 'bg-rose-500' },
      ];

      container.innerHTML = buckets
        .map(
          (b) => `
        <div class="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-3 h-3 rounded-full ${b.color}"></div>
            <div>
              <p class="font-bold text-slate-800 text-xs">${b.label}</p>
              <p class="text-[11px] text-slate-400">${b.count} invoices outstanding</p>
            </div>
          </div>
          <span class="font-bold text-slate-900 text-sm">₹${parseFloat(b.amount).toFixed(2)}</span>
        </div>
      `
        )
        .join('');
    }

    // Customer Growth Chart
    const growthRes = await api('/reports/customer-growth');
    const growth = growthRes.data || growthRes.growth || [];
    renderGrowthChart(growth);
  } catch (err) {
    console.error('Failed to load reports:', err);
  }
}

function renderGrowthChart(growth) {
  const ctx = document.getElementById('chart-customer-growth')?.getContext('2d');
  if (!ctx) return;

  if (state.charts.growth) {
    state.charts.growth.destroy();
  }

  const labels = growth.map((g) => g.month || 'Mo');
  const counts = growth.map((g) => g.count || 0);

  state.charts.growth = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.length ? labels : ['Sep 2026', 'Oct 2026', 'Nov 2026'],
      datasets: [
        {
          label: 'Cumulative Subscribers',
          data: counts.length ? counts : [1, 2, 3],
          borderColor: '#1A3C2B',
          backgroundColor: 'rgba(26, 60, 43, 0.08)',
          fill: true,
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

// =========================================================================
// TAB 8: SUBSCRIBER SELF-SERVICE PORTAL
// =========================================================================

async function loadCustomerPortal() {
  try {
    const custId = state.user?.customerId || '1';
    const profileRes = await api(`/customers/${custId}`);
    const cust = profileRes.data || profileRes;

    document.getElementById('portal-plan-name').textContent = cust.tariffPlan?.name || 'Postpaid Standard 299';
    document.getElementById('portal-plan-desc').textContent = cust.tariffPlan?.description || '';
    document.getElementById('portal-account-type').textContent = cust.tariffPlan?.type || 'POSTPAID';
    document.getElementById('portal-account-num').textContent = cust.accountNumber;
    document.getElementById('portal-wallet-balance').textContent = `₹${parseFloat(cust.prepaidBalance || 0).toFixed(2)}`;
    document.getElementById('portal-credit-limit').textContent = `₹${parseFloat(cust.creditLimit || 0).toFixed(2)}`;

    // Allowance Quotas
    const bucket = cust.allowanceBuckets?.[0] || cust.freeAllowanceBucket || {};
    const localRem = parseFloat(bucket.localMinutesRemaining || 0);
    const stdRem = parseFloat(bucket.stdMinutesRemaining || 0);
    const isdRem = parseFloat(bucket.isdMinutesRemaining || 0);

    const localTot = cust.tariffPlan?.includedLocalMinutes || 500;
    const stdTot = cust.tariffPlan?.includedStdMinutes || 200;
    const isdTot = cust.tariffPlan?.includedIsdMinutes || 0;

    const elQuotaLocal = document.getElementById('portal-quota-local');
    const elBarLocal = document.getElementById('portal-bar-local');
    if (elQuotaLocal) elQuotaLocal.textContent = `${localRem.toFixed(0)} / ${localTot} mins`;
    if (elBarLocal) elBarLocal.style.width = `${localTot > 0 ? (localRem / localTot) * 100 : 0}%`;

    const elQuotaStd = document.getElementById('portal-quota-std');
    const elBarStd = document.getElementById('portal-bar-std');
    if (elQuotaStd) elQuotaStd.textContent = `${stdRem.toFixed(0)} / ${stdTot} mins`;
    if (elBarStd) elBarStd.style.width = `${stdTot > 0 ? (stdRem / stdTot) * 100 : 0}%`;

    const elQuotaIsd = document.getElementById('portal-quota-isd');
    const elBarIsd = document.getElementById('portal-bar-isd');
    if (elQuotaIsd) elQuotaIsd.textContent = `${isdRem.toFixed(0)} / ${isdTot} mins`;
    if (elBarIsd) elBarIsd.style.width = `${isdTot > 0 ? (isdRem / isdTot) * 100 : 0}%`;

    // Customer Invoices
    const invRes = await api(`/customers/${custId}/billing`);
    const invoices = Array.isArray(invRes.data) ? invRes.data : (invRes.invoices || invRes.data?.invoices || []);

    const tbody = document.getElementById('portal-invoices-body');
    if (tbody) {
      if (invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-slate-400">No invoices for your account</td></tr>';
      } else {
        tbody.innerHTML = invoices
          .map((i) => `
          <tr class="hover:bg-slate-50 transition">
            <td class="px-6 py-3 font-mono font-bold text-slate-900">${i.invoiceNumber}</td>
            <td class="px-6 py-3 font-mono">${i.billingCycleCode}</td>
            <td class="px-6 py-3 font-mono">₹${parseFloat(i.rentalAmount || 0).toFixed(2)}</td>
            <td class="px-6 py-3 font-mono">₹${parseFloat(i.callCharges || 0).toFixed(2)}</td>
            <td class="px-6 py-3 font-bold text-slate-900">₹${parseFloat(i.totalAmount || 0).toFixed(2)}</td>
            <td class="px-6 py-3"><span class="${i.status === 'PAID' ? 'badge-paid' : 'badge-unpaid'}">${i.status}</span></td>
            <td class="px-6 py-3 text-right">
              <a href="${API_BASE}/invoices/${i.id}/pdf" target="_blank" class="btn-secondary py-1 px-2.5 text-[11px]">
                <i data-lucide="download" class="w-3.5 h-3.5 mr-1 inline"></i> PDF
              </a>
            </td>
          </tr>
        `).join('');
      }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    console.error('Failed to load customer portal:', err);
  }
}

// =========================================================================
// TAB 9: SMART BILL PREDICTION (HYBRID HWMA)
// =========================================================================

async function loadPrediction() {
  try {
    const custId = state.user?.customerId || '1';
    const predRes = await api(`/customers/${custId}/bill-prediction`);
    const pred = predRes.data || predRes;

    const prediction = pred.prediction || pred;

    const elPredTotal = document.getElementById('pred-predicted-total');
    const elConfidence = document.getElementById('pred-confidence-badge');
    const elNarrative = document.getElementById('pred-explanation-narrative');
    const elUsage = document.getElementById('pred-current-usage');
    const elRental = document.getElementById('pred-fixed-rental');
    const elCycleDay = document.getElementById('pred-cycle-day');

    if (elPredTotal) elPredTotal.textContent = `₹${parseFloat(prediction.predictedTotal || 352.82).toFixed(2)}`;
    if (elConfidence) elConfidence.textContent = `Confidence: ${Math.round((prediction.confidenceScore || 0.85) * 100)}%`;
    if (elNarrative) {
      elNarrative.textContent =
        prediction.explanation ||
        prediction.explanationNarrative ||
        'Based on current cycle run-rate and historical calling trends, your estimated bill will be ₹352.82 inclusive of GST.';
    }
    if (elUsage) elUsage.textContent = `₹${parseFloat(pred.unbilledUsage || 0).toFixed(2)}`;
    if (elRental) elRental.textContent = `₹${parseFloat(pred.fixedRental || 299).toFixed(2)}`;
    if (elCycleDay) elCycleDay.textContent = `Day ${pred.cycleDay || 14} / 30`;

    // Hourly Heatmap Analytics
    const analyticsRes = await api(`/customers/${custId}/analytics?period=current_cycle`);
    const analytics = analyticsRes.data || analyticsRes;
    renderHourlyHeatmap(analytics.hourlyDistribution || analytics.hourlyHeatmap || []);
  } catch (err) {
    console.error('Failed to load prediction:', err);
  }
}

function renderHourlyHeatmap(hourly) {
  const ctx = document.getElementById('chart-hourly-heatmap')?.getContext('2d');
  if (!ctx) return;

  if (state.charts.heatmap) {
    state.charts.heatmap.destroy();
  }

  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const values = Array(24).fill(0);

  if (Array.isArray(hourly)) {
    hourly.forEach((h) => {
      const hr = parseInt(h.hour || 0, 10);
      if (hr >= 0 && hr < 24) values[hr] = h.count || 1;
    });
  }

  // Provide synthetic curve if no data exists yet
  if (values.every((v) => v === 0)) {
    [9, 10, 11, 14, 15, 17, 18, 19, 20].forEach((h) => (values[h] = Math.floor(Math.random() * 5) + 1));
  }

  state.charts.heatmap = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hours,
      datasets: [
        {
          label: 'Calls Placed',
          data: values,
          backgroundColor: '#1A3C2B',
          borderRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 9 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0, font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: 'rgba(58, 58, 56, 0.10)' } },
      },
    },
  });
}

// =========================================================================
// NOTIFICATIONS & ALERTS
// =========================================================================

async function loadNotifications() {
  if (!state.token) return;

  try {
    const res = await api('/notifications?limit=10');
    const notifs = res.data || res.notifications || [];

    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');

    const unread = notifs.filter((n) => !n.isRead && !n.is_read);

    if (badge) {
      if (unread.length > 0) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    if (list) {
      if (notifs.length === 0) {
        list.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">No active alerts</div>';
        return;
      }

      list.innerHTML = notifs
        .map(
          (n) => `
        <div class="p-3 hover:bg-slate-50 transition cursor-pointer ${n.isRead || n.is_read ? 'opacity-60' : 'bg-indigo-50/30'}" onclick="markNotificationRead('${n.id}')">
          <p class="font-bold text-xs text-slate-800">${n.title}</p>
          <p class="text-[11px] text-slate-500 mt-0.5 line-clamp-2">${n.message}</p>
          <span class="text-[9px] text-slate-400 mt-1 block">${new Date(n.createdAt || n.created_at || Date.now()).toLocaleTimeString()}</span>
        </div>
      `
        )
        .join('');
    }
  } catch {
    // Non-fatal background fetch
  }
}

function toggleNotifications() {
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

async function markNotificationRead(id) {
  try {
    await api(`/notifications/${id}/read`, { method: 'PATCH' });
    await loadNotifications();
  } catch (err) {
    console.error(err);
  }
}

async function markAllNotificationsRead() {
  try {
    await api('/notifications/mark-all-read', { method: 'PATCH' });
    await loadNotifications();
    showToast('All notifications marked as read', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =========================================================================
// MODALS & FORM SUBMISSIONS
// =========================================================================

async function ensurePlansLoaded() {
  const planSelect = document.getElementById('customer-plan-select');
  if (!planSelect) return;

  try {
    if (!state.cachedPlans || state.cachedPlans.length === 0) {
      const res = await api('/tariffs');
      state.cachedPlans = Array.isArray(res.data) ? res.data : (res.plans || res.data?.plans || []);
    }
    if (state.cachedPlans && state.cachedPlans.length > 0) {
      planSelect.innerHTML = state.cachedPlans
        .map((p) => `<option value="${p.id}">${p.name} [${p.planCode}] (${p.type}) - ₹${parseFloat(p.monthlyRental || 0).toFixed(0)}/mo</option>`)
        .join('');
    }
  } catch (err) {
    console.warn('Could not refresh plans dropdown:', err);
  }
}

async function ensureCustomersLoaded() {
  const simSelect = document.getElementById('sim-customer-select');
  const billSelect = document.getElementById('billing-customer-select');
  if (!simSelect && !billSelect) return;

  try {
    if (!state.cachedCustomers || state.cachedCustomers.length === 0) {
      const res = await api('/customers?limit=100');
      state.cachedCustomers = Array.isArray(res.data) ? res.data : (res.customers || res.data?.customers || []);
    }
    if (state.cachedCustomers && state.cachedCustomers.length > 0) {
      populateCustomerDropdowns(state.cachedCustomers);
    }
  } catch (err) {
    console.warn('Could not refresh customer dropdowns:', err);
  }
}

async function ensureInvoicesLoaded() {
  const invSelect = document.getElementById('payment-invoice-select');
  if (!invSelect) return;

  try {
    if (!state.cachedInvoices || state.cachedInvoices.length === 0) {
      const res = await api('/invoices?limit=100');
      state.cachedInvoices = Array.isArray(res.data) ? res.data : (res.invoices || res.data?.invoices || []);
    }
    if (state.cachedInvoices && state.cachedInvoices.length > 0) {
      populateInvoiceDropdowns(state.cachedInvoices);
    }
  } catch (err) {
    console.warn('Could not refresh invoices dropdown:', err);
  }
}

async function openModal(modalId) {
  // Guard Admin-only actions from Operator
  if (state.user?.role === 'STAFF') {
    if (modalId === 'modal-add-plan') {
      showToast('Access Denied: Only Telecom Admin can configure tariff plans', 'error');
      return;
    }
    if (modalId === 'modal-simulate-traffic') {
      showToast('Access Denied: Only Telecom Admin can trigger synthetic traffic simulation', 'error');
      return;
    }
    if (modalId === 'modal-run-billing') {
      showToast('Access Denied: Only Telecom Admin can execute batch monthly billing runs', 'error');
      return;
    }
  }

  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');

  if (modalId === 'modal-add-customer') {
    await ensurePlansLoaded();
  } else if (modalId === 'modal-simulate-traffic' || modalId === 'modal-run-billing') {
    await ensureCustomersLoaded();
  } else if (modalId === 'modal-make-payment') {
    await ensureInvoicesLoaded();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

async function submitAddCustomer(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  try {
    const payload = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      address: formData.get('address'),
      planId: formData.get('tariffPlanId'),
      initialBalance: parseFloat(formData.get('initialBalance') || 0),
    };

    await api('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    showToast('Customer onboarded successfully!', 'success');
    closeModal('modal-add-customer');
    form.reset();
    await loadCustomers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitAddPlan(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  try {
    const payload = {
      planCode: formData.get('planCode')?.toUpperCase(),
      name: formData.get('name'),
      type: formData.get('type'),
      description: formData.get('description'),
      monthlyRental: parseFloat(formData.get('monthlyRental') || 0),
      pulseSeconds: parseInt(formData.get('pulseSeconds') || 60, 10),
      validityDays: formData.get('validityDays') ? parseInt(formData.get('validityDays'), 10) : undefined,
      rateLocal: parseFloat(formData.get('rateLocal') || 0.5),
      rateStd: parseFloat(formData.get('rateStd') || 0.75),
      rateIsd: parseFloat(formData.get('rateIsd') || 5.0),
      includedLocalMinutes: parseInt(formData.get('includedLocalMinutes') || 0, 10),
      includedStdMinutes: parseInt(formData.get('includedStdMinutes') || 0, 10),
    };

    await api('/tariffs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    showToast('Tariff Plan created successfully!', 'success');
    closeModal('modal-add-plan');
    form.reset();
    await loadTariffs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitSimulateTraffic(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  try {
    const payload = {
      callCount: parseInt(formData.get('callCount') || 20, 10),
      customerId: formData.get('customerId') || undefined,
    };

    const res = await api('/simulation/traffic', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    showToast(`Generated and rated ${res.count || payload.callCount} Poisson calls!`, 'success');
    closeModal('modal-simulate-traffic');
    await refreshActiveTab();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitRunBilling(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  try {
    const payload = {
      billingCycleCode: formData.get('billingCycleCode') || '2026-11',
      customerId: formData.get('customerId') || undefined,
    };

    const res = await api('/billing/run-cycle', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    showToast(`Billing run complete! Generated ${res.count || 0} invoices.`, 'success');
    closeModal('modal-run-billing');
    await loadInvoices();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitMakePayment(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  try {
    const invoiceId = formData.get('invoiceId') || undefined;
    const payload = {
      invoiceId: invoiceId || undefined,
      amount: parseFloat(formData.get('amount') || 0),
      paymentMethod: formData.get('paymentMethod') || 'UPI',
      idempotencyKey: `UI-PAY-${Date.now()}`,
    };

    await api('/payments/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    showToast('Payment settled and ledger updated!', 'success');
    closeModal('modal-make-payment');
    form.reset();
    await refreshActiveTab();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitSingleCdr(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  try {
    const now = new Date();
    const duration = parseInt(formData.get('durationSeconds') || 60, 10);
    const end = new Date(now.getTime() + duration * 1000);

    const payload = {
      callerMsisdn: formData.get('callerMsisdn'),
      receiverMsisdn: formData.get('receiverMsisdn'),
      callType: formData.get('callType'),
      durationSeconds: duration,
      startTime: now.toISOString(),
      endTime: end.toISOString(),
      status: 'COMPLETED',
    };

    await api('/cdrs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    showToast('Call Detail Record rated & ingested!', 'success');
    closeModal('modal-single-cdr');
    form.reset();
    await loadCdrs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitUploadCsv(event) {
  event.preventDefault();
  const fileInput = document.getElementById('csv-file-input');
  if (!fileInput.files.length) {
    showToast('Please select a CSV file', 'error');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const csvText = e.target.result;
      const res = await api('/cdrs/upload-csv', {
        method: 'POST',
        body: JSON.stringify({ csv: csvText }),
      });

      showToast(`CSV ingested! Success: ${res.successCount || 0}, Duplicates: ${res.duplicateCount || 0}`, 'success');
      closeModal('modal-upload-csv');
      await loadCdrs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  reader.readAsText(file);
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const typeClass = type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : 'toast-info';
  toast.className = `toast ${typeClass}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// =========================================================================
// SIDEBAR COLLAPSE & EXPAND CONTROLLER
// =========================================================================

function toggleSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  if (!sidebar) return;
  const isCollapsed = sidebar.classList.toggle('collapsed');
  document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  localStorage.setItem('telebill_sidebar_collapsed', isCollapsed ? 'true' : 'false');

  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  if (collapseBtn) {
    collapseBtn.innerHTML = isCollapsed
      ? '<i data-lucide="chevron-right" style="width:16px;height:16px;"></i>'
      : '<i data-lucide="chevron-left" style="width:16px;height:16px;"></i>';
    collapseBtn.title = isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
  }

  const topbarBtn = document.getElementById('topbar-sidebar-toggle');
  if (topbarBtn) {
    topbarBtn.title = isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function initSidebarState() {
  const savedState = localStorage.getItem('telebill_sidebar_collapsed');
  if (savedState === 'true') {
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar) {
      sidebar.classList.add('collapsed');
      document.body.classList.add('sidebar-collapsed');
      const collapseBtn = document.getElementById('sidebar-collapse-btn');
      if (collapseBtn) {
        collapseBtn.innerHTML = '<i data-lucide="chevron-right" style="width:16px;height:16px;"></i>';
        collapseBtn.title = 'Expand Sidebar';
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}
