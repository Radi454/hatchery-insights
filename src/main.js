import './styles.css';
import { supabase, supabaseConfigured, supabaseConfigError } from './supabase.js';
import { aggregateDashboard, durationMinutes, filterRows, getReportProducts, isKnownCustomer } from './dashboard-data.js';

const app = document.querySelector('#app');
const state = {
  session: null,
  rows: [],
  total: 0,
  dateMin: null,
  dateMax: null,
  refreshedAt: null,
  loading: false,
  loadingUserId: '',
  loadedUserId: '',
  sourceReportCount: 0,
  excludedInvalid: 0,
  error: '',
  authMode: 'password',
  otpEmail: '',
  page: 0,
  pageSize: 25,
  selectedProductId: '',
  selectedCustomerCode: '',
  customerMetric: 'birds',
  search: '',
  filters: { status: ['accepted'], dateFrom: '', dateTo: '', region: 'all', customerCode: '', productId: '' },
};
let requestId = 0;
let sourceRequestId = 0;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = value => new Intl.NumberFormat('en-US').format(Number(value) || 0);
const ampouleSummary = item => !item.ampoulesKnown ? 'غير مسجل' : item.ampoulesIncomplete ? `المسجل فقط: ${number(item.ampoules)}` : number(item.ampoules);
const birds = value => `${number(value)} طائر`;
const dateLabel = value => value ? new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) : '—';
const monthLabel = value => value ? new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`)) : '—';
const customerIdentity = row => row.customer_code || `unassigned:${row.id}`;
const customerLabel = row => { const name = isKnownCustomer(row) ? String(row.customer).trim() : 'عميل غير محدد'; const region = row.region ? String(row.region).trim() : null; if (!region) return `${name} (منطقة غير محددة)`; return name.endsWith(`(${region})`) ? name : `${name} (${region})`; };
const monthKey = date => date ? String(date).slice(0, 7) : '';

function renderShell() {
  app.innerHTML = `
    <header class="topbar"><a class="brand" href="#" aria-label="Hatchery Insights"><span class="brand-word">Zoetis</span><span class="brand-copy">Hatchery Insights<small>لوحة متابعة التحصين</small></span></a><div id="session-tools"></div></header>
    <main id="main-content" class="container"></main>
    <footer class="footer"><span>Hatchery Insights · مساحة عمل داخلية</span><span>مصدر البيانات: تقارير معامل التفريخ</span></footer>
    <dialog id="batch-dialog" class="dialog"><div id="dialog-content"></div></dialog>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>`;
  document.querySelector('.brand').addEventListener('click', event => event.preventDefault());
}

function renderLogin() {
  document.querySelector('#session-tools').innerHTML = '';
  document.querySelector('#main-content').innerHTML = `
    <section class="login-wrap"><form id="login-form" class="login-card">
      <div class="eyebrow">تسجيل دخول آمن</div><h1>مرحبًا بعودتك</h1><p class="muted">استخدم حسابك الحالي لمراجعة بيانات التقارير.</p>
      ${!supabaseConfigured ? `<div class="alert error">${escapeHtml(supabaseConfigError || 'إعداد الاتصال غير مكتمل. أضف VITE_SUPABASE_URL ومفتاحًا عامًا يبدأ بـ sb_publishable_ إلى بيئة التشغيل.')}</div>` : ''}
      ${state.error ? `<div class="alert error" role="alert">${escapeHtml(state.error)}</div>` : ''}
      <label>البريد الإلكتروني<input name="email" type="email" autocomplete="username" value="${escapeHtml(state.otpEmail)}" required ${!supabaseConfigured || state.loading ? 'disabled' : ''}></label>
      ${state.authMode === 'password' ? `<label>كلمة المرور<input name="password" type="password" autocomplete="current-password" required ${state.loading ? 'disabled' : ''}></label>` : state.authMode === 'code' ? `<label>رمز البريد الإلكتروني<input name="token" inputmode="numeric" autocomplete="one-time-code" required ${state.loading ? 'disabled' : ''}></label><p class="muted">افتح رابط الدخول من رسالة البريد. وإذا كانت الرسالة تحتوي على رمز، يمكنك إدخاله هنا.</p>` : '<p class="muted">هنرسل رابط دخول إلى بريد حسابك الحالي. افتح الرابط من الرسالة للمتابعة.</p>'}
      <button class="button primary full" type="submit" ${!supabaseConfigured || state.loading ? 'disabled' : ''}>${state.loading ? 'جارٍ التحقق…' : state.authMode === 'password' ? 'تسجيل الدخول' : state.authMode === 'code' ? 'التحقق من الرمز' : 'إرسال رابط الدخول'}</button>
      ${state.authMode === 'password' ? '<button id="otp-mode" class="button quiet full" type="button">الدخول عبر البريد</button>' : state.authMode === 'otp-email' ? '<button id="code-entry" class="button quiet full" type="button">لدي رمز دخول</button>' : '<button id="resend-otp" class="button quiet full" type="button">إرسال رمز جديد</button>'}
      ${state.authMode !== 'password' ? '<button id="password-mode" class="button quiet full" type="button">الدخول بكلمة المرور</button>' : ''}
      <p class="fineprint">الدخول متاح للحسابات المصرح بها فقط. إنشاء الحسابات غير متاح من هذه الصفحة.</p>
    </form></section>`;
  document.querySelector('#login-form')?.addEventListener('submit', signIn);
  document.querySelector('#otp-mode')?.addEventListener('click', () => { state.otpEmail = document.querySelector('[name="email"]')?.value || ''; state.authMode = 'otp-email'; state.error = ''; renderLogin(); });
  document.querySelector('#code-entry')?.addEventListener('click', () => { state.otpEmail = document.querySelector('[name="email"]')?.value || ''; state.authMode = 'code'; state.error = ''; renderLogin(); });
  document.querySelector('#password-mode')?.addEventListener('click', () => { state.authMode = 'password'; state.error = ''; renderLogin(); });
  document.querySelector('#resend-otp')?.addEventListener('click', () => sendOtp(state.otpEmail));
}

async function signIn(event) {
  event.preventDefault();
  if (!supabase) return;
  const form = new FormData(event.currentTarget);
  const email = String(form.get('email') || '').trim();
  state.otpEmail = email;
  if (state.authMode === 'otp-email') return sendOtp(email);
  state.loading = true;
  state.error = '';
  renderLogin();
  try {
    const result = state.authMode === 'code'
      ? await supabase.auth.verifyOtp({ email, token: String(form.get('token') || '').trim(), type: 'email' })
      : await supabase.auth.signInWithPassword({ email, password: form.get('password') });
    state.loading = false;
    if (result.error) {
      state.error = 'تعذر تسجيل الدخول. تحقق من بيانات الحساب أو الرمز وصلاحية الوصول.';
      renderLogin();
      return;
    }
    state.session = result.data.session;
    state.authMode = 'password';
    await loadDashboard();
  } catch {
    state.loading = false;
    state.error = 'تعذر تسجيل الدخول. تحقق من الاتصال ثم أعد المحاولة.';
    renderLogin();
  }
}

async function sendOtp(email) {
  if (!supabase || !email) {
    state.error = 'أدخل بريد الحساب الموجود أولًا.';
    renderLogin();
    return;
  }
  state.loading = true;
  state.error = '';
  renderLogin();
  try {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href } });
    state.loading = false;
    if (error) {
      state.error = 'تعذر إرسال رابط الدخول لهذا الحساب. تحقق من البريد أو صلاحية الوصول.';
      renderLogin();
      return;
    }
    state.authMode = 'code';
    renderLogin();
    document.querySelector('[name="token"]')?.focus();
  } catch {
    state.loading = false;
    state.error = 'تعذر إرسال رابط الدخول. تحقق من الاتصال ثم أعد المحاولة.';
    renderLogin();
  }
}

function sessionBar() {
  const email = state.session?.user?.email || '';
  document.querySelector('#session-tools').innerHTML = `<div class="session-actions"><span class="session-email">${escapeHtml(email)}</span><button id="logout" class="button quiet">تسجيل الخروج</button></div>`;
  document.querySelector('#logout').addEventListener('click', signOut);
}

async function signOut() {
  const current = supabase;
  requestId += 1;
  sourceRequestId += 1;
  const dialog = document.querySelector('#batch-dialog');
  if (dialog?.open) dialog.close();
  const dialogContent = document.querySelector('#dialog-content');
  if (dialogContent) dialogContent.replaceChildren();
  state.rows = [];
  state.total = 0;
  state.dateMin = null;
  state.dateMax = null;
  state.refreshedAt = null;
  state.sourceReportCount = 0;
  state.excludedInvalid = 0;
  state.loading = false;
  state.loadingUserId = '';
  state.loadedUserId = '';
  state.session = null;
  state.error = '';
  state.authMode = 'password';
  state.otpEmail = '';
  state.page = 0;
  state.search = '';
  state.customerMetric = 'birds';
  state.filters = { status: ['accepted'], dateFrom: '', dateTo: '', region: 'all', customerCode: '', productId: '' };
  state.selectedProductId = '';
  state.selectedCustomerCode = '';
  renderLogin();
  if (current) await current.auth.signOut({ scope: 'local' });
}

async function loadDashboard() {
  if (!supabase || !state.session) return;
  const userId = state.session.user.id;
  if (state.loading && state.loadingUserId === userId) return;
  if (!state.loading && state.loadedUserId === userId) return;
  const id = ++requestId;
  state.loading = true;
  state.loadingUserId = userId;
  state.error = '';
  sessionBar();
  renderLoading();
  const batchSize = 1000;
  let offset = 0;
  let expectedTotal = null;
  let allRows = [];
  let metadata = null;
  try {
    while (expectedTotal === null || offset < expectedTotal) {
      if (id !== requestId || !state.session) return;
      const { data, error } = await supabase.rpc('hatchery_dashboard_data', { p_offset: offset, p_limit: batchSize });
      if (error) throw error;
      if (!data || !Array.isArray(data.rows) || !Number.isInteger(data.total)) throw new Error('Unexpected dashboard response.');
      if (expectedTotal !== null && expectedTotal !== data.total) throw new Error('Data changed during loading; retry.');
      expectedTotal = data.total;
      metadata = data;
      allRows = allRows.concat(data.rows);
      if (data.rows.length === 0 || data.rows.length < batchSize) {
        if (allRows.length < expectedTotal) throw new Error('Dashboard pagination ended before all rows loaded.');
        break;
      }
      offset += data.rows.length;
    }
    if (id !== requestId || !state.session) return;
    if (allRows.length !== expectedTotal || new Set(allRows.map(row => row.id)).size !== expectedTotal) throw new Error('Incomplete or duplicate report pages.');
    state.rows = allRows;
    state.total = expectedTotal ?? 0;
    state.dateMin = metadata?.date_min ?? null;
    state.dateMax = metadata?.date_max ?? null;
    state.refreshedAt = metadata?.refreshed_at ?? null;
    state.sourceReportCount = metadata?.source_report_count ?? expectedTotal ?? 0;
    state.excludedInvalid = metadata?.excluded_invalid ?? 0;
    state.loading = false;
    state.loadingUserId = '';
    state.loadedUserId = userId;
    state.page = 0;
    renderDashboard();
  } catch (error) {
    if (id !== requestId || !state.session) return;
    console.error('Dashboard data load failed', error);
    state.rows = [];
    state.total = 0;
    state.loading = false;
    state.loadingUserId = '';
    state.loadedUserId = '';
    state.error = error?.code === '42501' || error?.status === 403
      ? 'هذا الحساب غير مصرح له بعرض بيانات لوحة التحصين.'
      : 'تعذر تحميل البيانات كاملة. حدّث الصفحة أو تحقق من الاتصال والصلاحيات.';
    renderDashboard();
  }
}

function renderLoading() {
  document.querySelector('#main-content').innerHTML = '<section class="panel loading-card"><div class="spinner" aria-hidden="true"></div><p>جارٍ تحميل بيانات التقارير…</p></section>';
}

function currentRows() {
  const filters = { ...state.filters, status: [...state.filters.status] };
  return filterRows(state.rows, filters);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(value => value != null && value !== ''))].sort((a, b) => String(a).localeCompare(String(b), 'ar'));
}

function filterOptions(rows) {
  const regions = uniqueSorted(rows.map(row => row.region));
  const customerRows = new Map();
  for (const row of rows) {
    if (!isKnownCustomer(row)) continue;
    const key = customerIdentity(row);
    if (!customerRows.has(key)) customerRows.set(key, row);
  }
  const products = new Map();
  rows.forEach(row => (row.products || []).forEach(product => { if (product.id && product.name) products.set(product.id, product.name); }));
  return { regions, customers: [...customerRows.entries()].sort((a, b) => customerLabel(a[1]).localeCompare(customerLabel(b[1]), 'ar')), products: [...products.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ar')) };
}

function renderDashboard() {
  sessionBar();
  const rows = currentRows();
  const stats = aggregateDashboard(rows);
  const options = filterOptions(state.rows);
  const regionValue = state.filters.region;
  const productDetailItems = options.products.map(([id, name]) => `<option value="${escapeHtml(id)}" ${state.selectedProductId === id ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
  const regionItems = options.regions.map(region => `<option value="${escapeHtml(region)}" ${regionValue === region ? 'selected' : ''}>${escapeHtml(region)}</option>`).join('');
  const customerItems = options.customers.map(([code, row]) => `<option value="${escapeHtml(code)}" ${state.filters.customerCode === code ? 'selected' : ''}>${escapeHtml(customerLabel(row))}</option>`).join('');
  const productItems = options.products.map(([id, name]) => `<option value="${escapeHtml(id)}" ${state.filters.productId === id ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
  const statusNames = { accepted: 'معتمد', needs_review: 'بحاجة للمراجعة', rejected: 'مستبعد' };
  const knownStatuses = uniqueSorted(state.rows.map(row => row.status));
  const pendingReviewCount = state.rows.filter(row => row.status === 'needs_review').length;
  document.querySelector('#main-content').innerHTML = `
    <div class="page-heading"><div><div class="eyebrow">ملخص البيانات · معامل التفريخ</div><h1>لوحة متابعة التحصين</h1><p class="muted">بيانات حقيقية حسب صلاحيات الحساب · تُحسب الطيور مرة واحدة لكل تقرير.</p></div><button id="export-csv" class="button outline">تصدير CSV</button></div>
    <section class="filters panel" aria-label="مرشحات التقارير"><div class="filter-title"><div><h2>تصفية التقارير</h2><p>المرشحات تطبق على المؤشرات والمنتجات والعملاء والدفعات.</p></div><button id="clear-filters" class="button quiet">مسح المرشحات</button></div><div class="filter-grid">
      <label>من تاريخ<input id="date-from" type="date" value="${escapeHtml(state.filters.dateFrom)}"></label><label>إلى تاريخ<input id="date-to" type="date" value="${escapeHtml(state.filters.dateTo)}"></label>
      <label>المنطقة التشغيلية<select id="region-filter"><option value="all">كل المناطق</option><option value="__unassigned__" ${regionValue === '__unassigned__' ? 'selected' : ''}>غير محددة</option>${regionItems}</select></label>
      <label>العميل / الكود<select id="customer-filter"><option value="">كل العملاء</option>${customerItems}</select></label>
      <label>المنتج<select id="product-filter"><option value="">كل المنتجات</option>${productItems}</select></label>
      <fieldset class="status-filter"><legend>حالة التقرير</legend>${knownStatuses.map(status => `<label class="check-label"><input type="checkbox" name="status" value="${escapeHtml(status)}" ${state.filters.status.includes(status) ? 'checked' : ''}> ${escapeHtml(statusNames[status] || status)}</label>`).join('')}</fieldset>
    </div></section>
    ${state.error ? `<div class="alert error" role="alert">${escapeHtml(state.error)} <button id="retry" class="button quiet">إعادة المحاولة</button></div>` : ''}
    <div class="coverage-line"><span>يعرض ${number(rows.length)} من ${number(state.total)} تقريرًا</span><span>بانتظار المراجعة: ${number(pendingReviewCount)}</span><span>المسجل فقط · ${number(state.sourceReportCount ?? state.total)} تقريرًا بالمصدر · ${number(state.excludedInvalid ?? 0)} مستبعد لغياب عدد الطيور</span><span>تاريخ البيانات المتاح: ${dateLabel(state.dateMin)} – ${dateLabel(state.dateMax)} · الفترة الأخيرة حتى ${dateLabel(state.dateMax)}</span><span>آخر تحديث: ${state.refreshedAt ? new Date(state.refreshedAt).toLocaleString('ar-EG') : '—'}</span></div>
    <section class="metrics-grid" aria-label="المؤشرات"><article class="metric-card"><span>طيور فريدة ضمن التقارير</span><strong>${number(stats.birds)}</strong><small>التقرير يُحسب مرة واحدة مهما تعددت اللقاحات</small></article><article class="metric-card"><span>عدد التقارير / الدفعات</span><strong>${number(stats.batches)}</strong><small>وفق المرشحات المحددة</small></article><article class="metric-card"><span>عملاء نشطون</span><strong>${number(stats.customers)}</strong><small>كل سجل عميل مستقل بحسب كوده</small></article><article class="metric-card"><span>منتجات مسجلة</span><strong>${number(stats.productById.size)}</strong><small>تغطية المنتج قد تتداخل بين الدفعات</small></article></section>
    <section class="panel products-panel"><div class="section-heading"><div><div class="eyebrow">تحليل المنتجات</div><h2>أداء اللقاحات والمنتجات</h2><p class="muted">تغطية الطيور حسب المنتج · النتائج ضمن التقارير المطابقة للمرشحات</p></div><label class="inline-select">المنتج المحدد<select id="product-detail"><option value="">اختر منتجًا</option>${productDetailItems}</select></label></div><div class="overlap-note"><b>تداخل تغطية المنتج:</b> قد يُسجل أكثر من منتج في التقرير نفسه. كل منتج يحتسب طيور التقرير مرة ضمن تغطيته، لذلك مجموع تغطيات المنتجات قد يتجاوز إجمالي الطيور الفريدة ولا يمثل حصة سوقية. كميات منتجات المنافسين غير معروضة.</div>${stats.competitorNames.size ? `<p class="competitor-context">أسماء منتجات منافسة مذكورة في التقارير: ${[...stats.competitorNames].map(escapeHtml).join('، ')}.</p>` : ''}<div class="products-grid"><div class="table-scroll"><table><thead><tr><th>المنتج</th><th>طيور مغطاة</th><th>تقارير</th><th>عملاء</th><th>أمبولات</th></tr></thead><tbody>${renderProductRows(stats.productById)}</tbody></table></div><div id="product-detail-panel" class="product-detail"><div class="empty-state">اختر منتجًا لعرض اتجاهه والعملاء والمناطق.</div></div></div></section>
    <section class="charts-grid"><article class="panel"><div class="section-heading"><div><h2>اتجاه الطيور عبر الأشهر</h2><p class="muted">الطيور الفريدة في التقارير المطابقة للمرشحات</p></div></div><div id="overall-chart">${renderBirdChart(rows, 'overall')}</div></article><article class="panel"><h2>التوزيع التشغيلي للمناطق</h2><p class="muted">أعداد التقارير والطيور؛ المنطقة غير المحددة تظهر منفصلة.</p><div id="region-bars">${renderRegionBars(stats.regionByName)}</div></article></section>
    <section class="panel customer-panel"><div class="section-heading"><div><div class="eyebrow">تحليل العملاء</div><h2>العملاء والدفعات</h2><p class="muted">أكواد العملاء مستقلة ولو تشابه الاسم. اختر عميلًا للاطلاع على نشاطه.</p></div><div class="customer-search"><label for="customer-search">بحث العملاء</label><input id="customer-search" type="search" value="${escapeHtml(state.search)}" placeholder="اسم العميل أو الكود"></div></div><div class="customer-layout"><aside id="customer-list" class="customer-list"></aside><div id="customer-profile" class="customer-profile"><div class="empty-state">اختر عميلًا من القائمة.</div></div></div></section>
    <section class="panel reports-panel"><div class="section-heading"><div><h2>التقارير الأخيرة</h2><p class="muted">${number(rows.length)} تقرير مطابق · تعرض الصفحة ${number(state.pageSize)} تقريرًا</p></div><div class="pagination"><button id="previous-page" class="button quiet" ${state.page === 0 ? 'disabled' : ''}>السابق</button><span>صفحة ${state.page + 1} من ${Math.max(1, Math.ceil(rows.length / state.pageSize))}</span><button id="next-page" class="button quiet" ${(state.page + 1) * state.pageSize >= rows.length ? 'disabled' : ''}>التالي</button></div></div><div class="table-scroll"><table><thead><tr><th>التقرير</th><th>التاريخ</th><th>العميل / المنطقة</th><th>المفرخ</th><th>الطيور</th><th>المنتجات المسجلة</th><th>الحالة</th><th>تفاصيل</th></tr></thead><tbody>${renderReportRows(rows)}</tbody></table></div></section>`;
  bindDashboardEvents();
  renderCustomerAnalysis(rows);
  renderProductDetail(rows);
}

function renderProductRows(products) {
  const sorted = [...products.values()].sort((a, b) => b.birds - a.birds || a.name.localeCompare(b.name, 'ar'));
  if (!sorted.length) return '<tr><td colspan="5" class="empty-row">لا توجد منتجات في التقارير المطابقة.</td></tr>';
  return sorted.map(product => `<tr><td><button class="text-action product-choice" data-product-id="${escapeHtml(product.id)}">${escapeHtml(product.name)}</button>${product.isCompetitor ? '<span class="small-tag">منافس</span>' : ''}</td><td>${number(product.birds)}</td><td>${number(product.batches)}</td><td>${number(product.customers.size)}</td><td>${product.isCompetitor ? '—' : ampouleSummary(product)}</td></tr>`).join('');
}

function renderRegionBars(regions) {
  const data = [...regions.values()].sort((a, b) => b.batches - a.batches);
  if (!data.length) return '<div class="empty-state">لا توجد تقارير ضمن المرشحات.</div>';
  const max = Math.max(...data.map(region => region.batches), 1);
  return data.map(region => `<div class="region-row"><span>${escapeHtml(region.name || 'منطقة غير محددة')}</span><div class="bar"><i style="width:${Math.max(4, region.batches / max * 100)}%"></i></div><b>${number(region.batches)} تقرير</b><small>${number(region.birds)} طائر</small></div>`).join('');
}

function renderBirdChart(rows, suffix = '') {
  if (!rows.length) return '<div class="empty-state">لا توجد بيانات للرسم ضمن المرشحات.</div>';
  const monthly = new Map();
  for (const row of rows) {
    const key = monthKey(row.date);
    if (!key) continue;
    monthly.set(key, (monthly.get(key) || 0) + (Number(row.bird_count) || 0));
  }
  const points = [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (!points.length) return '<div class="empty-state">لا تتوفر تواريخ للرسم.</div>';
  const max = Math.max(...points.map(([, value]) => value), 1);
  const tickEvery = Math.max(1, Math.ceil(points.length / 8));
  const coords = points.map(([, value], index) => [75 + index * (590 / Math.max(points.length - 1, 1)), 190 - value / max * 145]);
  const path = coords.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ');
  return `<svg class="chart" viewBox="0 0 700 245" role="img" aria-label="اتجاه الطيور حسب الشهر"><g class="grid-lines"><path d="M70 45H685M70 90H685M70 135H685M70 190H685"/></g><g class="axis-labels" direction="ltr" text-anchor="end"><text x="64" y="190">0</text><text x="64" y="135">${number(max * .33)}</text><text x="64" y="90">${number(max * .66)}</text><text x="64" y="45">${number(max)}</text>${points.map(([month], index) => index % tickEvery === 0 || index === points.length - 1 ? `<text x="${coords[index][0]}" y="222" text-anchor="middle">${escapeHtml(monthLabel(month))}</text>` : '').join('')}</g><path d="${path}" class="chart-line"/>${coords.map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="4" class="chart-dot"><title>${escapeHtml(monthLabel(points[index][0]))}: ${number(points[index][1])} طائر</title></circle>`).join('')}</svg>`;
}

function renderProductDetail(rows) {
  const panel = document.querySelector('#product-detail-panel');
  const selected = state.selectedProductId || document.querySelector('#product-detail')?.value;
  if (!selected || !panel) return;
  const associated = rows.filter(row => row.products?.some(product => product.id === selected));
  const product = associated.flatMap(row => row.products).find(item => item.id === selected);
  if (!associated.length || !product) {
    panel.innerHTML = '<div class="empty-state">لا توجد تقارير مطابقة لهذا المنتج في النطاق الحالي.</div>';
    return;
  }
  if (product.is_competitor) {
    panel.innerHTML = `<div class="detail-title"><div><span class="eyebrow">اسم منتج منافس</span><h3>${escapeHtml(product.name)}</h3></div><button class="button quiet" id="clear-product-detail">مسح</button></div><p class="muted">يظهر الاسم فقط. لا تعرض اللوحة كميات أو تغطية أو عدد تقارير لمنتجات المنافسين.</p>`;
    document.querySelector('#clear-product-detail')?.addEventListener('click', () => { state.selectedProductId = ''; renderDashboard(); });
    return;
  }

  const uniqueProductRows = associated.map(row => ({ ...row, bird_count: Number(row.bird_count) || 0 }));
  const productBirds = uniqueProductRows.reduce((sum, row) => sum + row.bird_count, 0);
  const customers = new Map();
  const regions = new Map();
  associated.forEach(row => {
    if (isKnownCustomer(row)) {
      const key = customerIdentity(row);
      const entry = customers.get(key) || { label: customerLabel(row), birds: 0, batches: 0 };
      entry.birds += Number(row.bird_count) || 0;
      entry.batches += 1;
      customers.set(key, entry);
    }
    const regionKey = row.region || '__unassigned__';
    const region = regions.get(regionKey) || { label: row.region || 'منطقة غير محددة', birds: 0, batches: 0 };
    region.birds += Number(row.bird_count) || 0;
    region.batches += 1;
    regions.set(regionKey, region);
  });
  const topCustomers = [...customers.values()].sort((a, b) => b.birds - a.birds).slice(0, 5);
  const regionRows = [...regions.values()].sort((a, b) => b.birds - a.birds);
  panel.innerHTML = `<div class="detail-title"><div><span class="eyebrow">تفاصيل المنتج</span><h3>${escapeHtml(product.name)}</h3></div><button class="button quiet" id="clear-product-detail">مسح</button></div><div class="detail-kpis"><div><small>طيور ضمن المنتج</small><b>${number(productBirds)}</b></div><div><small>تقارير</small><b>${number(associated.length)}</b></div><div><small>عملاء بأكواد مستقلة</small><b>${number(customers.size)}</b></div></div><p class="muted product-context">تُحسب طيور التقرير مرة واحدة ضمن هذا المنتج. تغطيات المنتجات قد تتداخل.</p><div class="detail-columns"><div><h4>اتجاه الطيور</h4>${renderBirdChart(uniqueProductRows, 'product')}</div><div><h4>العملاء والمناطق</h4><div class="mini-list">${topCustomers.map(row => `<div><span>${escapeHtml(row.label)}</span><b>${number(row.birds)} طائر · ${row.batches} تقارير</b></div>`).join('') || '<p>لا يوجد عملاء.</p>'}</div><div class="mini-list region-list">${regionRows.map(row => `<div><span>${escapeHtml(row.label)}</span><b>${number(row.birds)} طائر · ${row.batches}</b></div>`).join('')}</div></div></div>`;
  document.querySelector('#clear-product-detail')?.addEventListener('click', () => { state.selectedProductId = ''; renderDashboard(); });
}

function renderCustomerAnalysis(rows) {
  const list = document.querySelector('#customer-list');
  const profile = document.querySelector('#customer-profile');
  if (!list || !profile) return;
  const grouped = new Map();
  rows.forEach(row => {
    if (!isKnownCustomer(row)) return;
    const key = customerIdentity(row);
    const current = grouped.get(key) || { code: key, name: row.customer || 'عميل غير محدد', rows: [], regions: new Set() };
    current.rows.push(row);
    if (row.region) current.regions.add(row.region);
    grouped.set(key, current);
  });
  const entries = [...grouped.values()].map(entry => ({ ...entry, birds: entry.rows.reduce((sum, row) => sum + (Number(row.bird_count) || 0), 0), latest: entry.rows.reduce((latest, row) => !latest || row.date > latest ? row.date : latest, null) })).sort((a, b) => b.birds - a.birds);
  const searched = entries.filter(entry => `${entry.name} ${entry.code} ${[...entry.regions].join(' ')}`.toLocaleLowerCase().includes(state.search.toLocaleLowerCase()));
  if (!searched.some(entry => entry.code === state.selectedCustomerCode)) state.selectedCustomerCode = searched[0]?.code || '';
  list.innerHTML = searched.length ? searched.map(entry => `<button class="customer-result ${entry.code === state.selectedCustomerCode ? 'active' : ''}" data-customer-code="${escapeHtml(entry.code)}"><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml([...entry.regions].join('، ') || 'منطقة غير محددة')}</small><span>${number(entry.birds)} طائر · ${entry.rows.length} تقارير</span></button>`).join('') : '<div class="empty-state">لا يوجد عملاء يطابقون البحث.</div>';
  list.querySelectorAll('[data-customer-code]').forEach(button => button.addEventListener('click', () => { state.selectedCustomerCode = button.dataset.customerCode; renderCustomerAnalysis(rows); }));
  const selected = entries.find(entry => entry.code === state.selectedCustomerCode);
  if (!selected) {
    profile.innerHTML = '<div class="empty-state">لا توجد بيانات عميل ضمن المرشحات.</div>';
    return;
  }
  const customerRows = [...selected.rows].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.id).localeCompare(String(b.id)));
  const latestDate = customerRows[customerRows.length - 1]?.date;
  const activeMonths = new Set(customerRows.map(row => monthKey(row.date)).filter(Boolean)).size;
  const customerStats = aggregateDashboard(customerRows);
  const competitorNames = customerStats.competitorNames;
  const products = [...customerStats.productById.values()].map(product => ({ ...product, reports: product.batches })).sort((a,b) => b.birds-a.birds);
  const monthValues = new Map();
  customerRows.forEach(row => {
    const key = monthKey(row.date);
    if (!key) return;
    const item = monthValues.get(key) || { birds: 0, batches: 0 };
    item.birds += Number(row.bird_count) || 0;
    item.batches += 1;
    monthValues.set(key, item);
  });
  profile.innerHTML = `<div class="profile-head"><div><span class="eyebrow">ملف العميل</span><h3>${escapeHtml(selected.name)}</h3><p>كود العميل: ${escapeHtml(selected.code)} · ${escapeHtml([...selected.regions].join('، ') || 'منطقة غير محددة')}</p></div><div class="segmented" role="group" aria-label="مقياس الاتجاه الشهري"><button data-customer-metric="birds" aria-pressed="${state.customerMetric === 'birds'}">الطيور</button><button data-customer-metric="batches" aria-pressed="${state.customerMetric === 'batches'}">التقارير</button></div></div><div class="customer-kpis"><div><small>طيور فريدة ضمن التقارير</small><b>${number(selected.birds)}</b></div><div><small>عدد التقارير</small><b>${number(customerRows.length)}</b></div><div><small>آخر تقرير</small><b>${dateLabel(latestDate)}</b></div><div><small>أشهر بها نشاط</small><b>${number(activeMonths)}</b></div></div><div class="customer-month-chart"><div class="section-heading"><h4>النشاط عبر الأشهر</h4><span>${state.customerMetric === 'birds' ? 'عدد الطيور' : 'عدد التقارير'}</span></div>${renderCustomerChart(monthValues, state.customerMetric)}</div><div class="customer-detail-grid"><div><h4>المنتجات المسجلة</h4><p class="muted">طيور المنتج تتداخل إذا احتوت الدفعة منتجات متعددة. المنافسون يظهرون بالاسم فقط.</p><div class="table-scroll"><table><thead><tr><th>المنتج</th><th>طيور المنتج</th><th>تقارير</th><th>أمبولات</th></tr></thead><tbody>${products.map(product => `<tr><td>${escapeHtml(product.name)}</td><td>${number(product.birds)}</td><td>${number(product.reports)}</td><td>${ampouleSummary(product)}</td></tr>`).join('') || '<tr><td colspan="4">لا توجد منتجات.</td></tr>'}</tbody></table></div>${competitorNames.size ? `<p class="muted">منتجات منافسة مسجلة بالاسم فقط: ${[...competitorNames].map(escapeHtml).join('، ')}.</p>` : ''}</div><div><h4>دفعات العميل</h4><p class="muted">الأحدث أولًا · تُعرض تفاصيل السجل كما وردت في البيانات.</p><div class="table-scroll"><table><thead><tr><th>التاريخ</th><th>الطيور</th><th>التفاصيل</th></tr></thead><tbody>${[...customerRows].reverse().map(row => `<tr><td>${dateLabel(row.date)}</td><td>${number(row.bird_count)}</td><td><details><summary>تفاصيل التقرير</summary><div class="batch-expansion"><p>المرجع: ${escapeHtml(row.reference || row.printed_report_number || '—')}</p><p>المفرخ: ${escapeHtml(row.hatchery || '—')}</p><p>المنتجات: ${(row.products || []).map(product => escapeHtml(product.name) + (product.is_competitor ? '' : ` · ${product.ampoule_count == null ? 'الكمية غير مسجلة' : `${number(product.ampoule_count)} أمبولة`}${product.batch_lot ? ` · ${escapeHtml(product.batch_lot)}` : ''}`)).join('، ') || '—'}</p><p>الفترة: ${escapeHtml(row.start_time || '—')} – ${escapeHtml(row.end_time || '—')}</p></div></details></td></tr>`).join('')}</tbody></table></div></div></div>`;
  profile.querySelectorAll('[data-customer-metric]').forEach(button => button.addEventListener('click', () => { state.customerMetric = button.dataset.customerMetric; renderCustomerAnalysis(rows); }));
}

function renderCustomerChart(monthValues, metric) {
  const keys = [...monthValues.keys()].sort();
  if (!keys.length) return '<div class="empty-state">لا توجد تواريخ صالحة للرسم.</div>';
  const values = keys.map(key => monthValues.get(key)[metric]);
  const max = Math.max(...values, 1);
  const coords = values.map((value, index) => [70 + index * (600 / Math.max(values.length - 1, 1)), 140 - value / max * 100]);
  const path = coords.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ');
  return `<svg class="chart customer-chart" viewBox="0 0 700 180" role="img" aria-label="${metric === 'birds' ? 'طيور' : 'تقارير'} العميل حسب الشهر"><g class="grid-lines"><path d="M65 40H685M65 90H685M65 140H685"/></g><g class="axis-labels" direction="ltr" text-anchor="end"><text x="58" y="140">0</text><text x="58" y="90">${Math.round(max / 2)}</text><text x="58" y="40">${max}</text>${keys.map((key, index) => index % Math.max(1, Math.ceil(keys.length / 8)) === 0 || index === keys.length - 1 ? `<text x="${coords[index][0]}" y="166" text-anchor="middle">${escapeHtml(monthLabel(key))}</text>` : '').join('')}</g><path d="${path}" class="chart-line"/>${coords.map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="4" class="chart-dot"><title>${escapeHtml(monthLabel(keys[index]))}: ${number(values[index])} ${metric === 'birds' ? 'طائر' : 'تقارير'}</title></circle>`).join('')}</svg>`;
}

function renderReportRows(rows) {
  const pageRows = [...rows].sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.id).localeCompare(String(a.id))).slice(state.page * state.pageSize, (state.page + 1) * state.pageSize);
  if (!pageRows.length) return '<tr><td colspan="8" class="empty-row">لا توجد تقارير مطابقة.</td></tr>';
  const statusLabels = { accepted: 'معتمد', needs_review: 'بحاجة للمراجعة', rejected: 'مستبعد' };
  return pageRows.map(row => `<tr><td>${escapeHtml(row.printed_report_number || row.reference || row.id)}</td><td>${dateLabel(row.date)}</td><td>${escapeHtml(customerLabel(row))}</td><td>${escapeHtml(row.hatchery || '—')}</td><td>${number(row.bird_count)}</td><td>${(row.products || []).map(product => escapeHtml(product.name || 'منتج غير محدد')).join('، ') || '—'}</td><td><span class="status ${row.status === 'accepted' ? 'accepted' : 'review'}">${escapeHtml(statusLabels[row.status] || row.status || '—')}</span></td><td><button class="button small" data-open-report="${escapeHtml(row.id)}">فتح</button></td></tr>`).join('');
}

function bindDashboardEvents() {
  document.querySelector('#date-from').addEventListener('change', event => changeFilter('dateFrom', event.target.value));
  document.querySelector('#date-to').addEventListener('change', event => changeFilter('dateTo', event.target.value));
  document.querySelector('#region-filter').addEventListener('change', event => changeFilter('region', event.target.value));
  document.querySelector('#customer-filter').addEventListener('change', event => changeFilter('customerCode', event.target.value));
  document.querySelector('#product-filter').addEventListener('change', event => changeFilter('productId', event.target.value));
  document.querySelectorAll('input[name="status"]').forEach(input => input.addEventListener('change', () => {
    state.filters.status = [...document.querySelectorAll('input[name="status"]:checked')].map(item => item.value);
    state.page = 0;
    renderDashboard();
  }));
  document.querySelector('#clear-filters').addEventListener('click', () => {
    state.filters = { status: ['accepted'], dateFrom: '', dateTo: '', region: 'all', customerCode: '', productId: '' };
    state.page = 0;
    state.selectedProductId = '';
    state.selectedCustomerCode = '';
    renderDashboard();
  });
  document.querySelector('#export-csv').addEventListener('click', exportCsv);
  document.querySelector('#previous-page').addEventListener('click', () => { state.page = Math.max(0, state.page - 1); renderDashboard(); });
  document.querySelector('#next-page').addEventListener('click', () => { state.page += 1; renderDashboard(); });
  document.querySelector('#customer-search').addEventListener('input', event => { state.search = event.target.value; const position = event.target.selectionStart; renderDashboard(); const input = document.querySelector('#customer-search'); input.focus(); input.setSelectionRange(position, position); });
  document.querySelectorAll('[data-open-report]').forEach(button => button.addEventListener('click', () => openReport(button.dataset.openReport)));
  document.querySelectorAll('.product-choice').forEach(button => button.addEventListener('click', () => { state.selectedProductId = button.dataset.productId; const detail = document.querySelector('#product-detail'); detail.value = state.selectedProductId; renderProductDetail(currentRows()); }));
  document.querySelector('#product-detail').addEventListener('change', event => { state.selectedProductId = event.target.value; renderProductDetail(currentRows()); });
  document.querySelector('#retry')?.addEventListener('click', loadDashboard);
}

function changeFilter(name, value) {
  state.filters[name] = value;
  state.page = 0;
  renderDashboard();
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const rows = currentRows();
  const header = ['التقرير', 'التاريخ', 'كود العميل', 'العميل', 'المنطقة', 'المفرخ', 'الطيور', 'المدة بالدقائق', 'الحالة', 'المنتجات'];
  const records = rows.map(row => {
    const productNames = (row.products || []).map(product => product.is_competitor ? product.name : `${product.name} (${product.ampoule_count == null ? 'الكمية غير مسجلة' : `${number(product.ampoule_count)} أمبولة`})`).join(' | ');
    return [row.printed_report_number || row.reference || row.id, row.date, row.customer_code, row.customer, row.region, row.hatchery, row.bird_count, durationMinutes(row.start_time, row.end_time) ?? '', row.status, productNames];
  });
  const csv = '\ufeff' + [header, ...records].map(record => record.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `hatchery-reports-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function openReport(id) {
  const row = state.rows.find(item => String(item.id) === String(id));
  if (!row) return;
  const dialog = document.querySelector('#batch-dialog');
  const content = document.querySelector('#dialog-content');
  sourceRequestId += 1;
  const products = getReportProducts(row);
  const duration = durationMinutes(row.start_time, row.end_time);
  content.innerHTML = `<div class="dialog-head"><div><span class="eyebrow">تفاصيل التقرير</span><h2>${escapeHtml(row.printed_report_number || row.reference || row.id)}</h2></div><button class="icon-button" id="close-dialog" aria-label="إغلاق">×</button></div><div class="dialog-facts"><div><small>العميل</small><b>${escapeHtml(customerLabel(row))}</b></div><div><small>التاريخ</small><b>${dateLabel(row.date)}</b></div><div><small>المفرخ</small><b>${escapeHtml(row.hatchery || '—')}</b></div><div><small>الطيور</small><b>${number(row.bird_count)}</b></div><div><small>المنطقة وحالتها</small><b>${escapeHtml(row.region || 'غير محددة')} · ${escapeHtml(({confirmed:'مؤكدة',proposed:'مستندة للتاريخ',unresolved:'تحتاج تحديد'})[row.region_status] || '—')}</b></div><div><small>المندوب / المهندس</small><b>${escapeHtml([row.sales_rep, row.engineer].filter(Boolean).join(' · ') || '—')}</b></div><div><small>الوقت المسجل</small><b>${escapeHtml(row.start_time || '—')} – ${escapeHtml(row.end_time || '—')}</b></div><div><small>المدة</small><b>${duration == null ? 'غير متاحة' : `${duration} دقيقة`}</b></div></div><section class="dialog-products"><h3>اللقاحات والمنتجات</h3><div>${products.map(product => `<div class="dialog-product"><span>${escapeHtml(product.name)}${product.competitor ? ' · منافس' : ''}</span><span>${product.competitor ? '' : product.ampoules == null ? 'الكمية غير مسجلة' : `${number(product.ampoules)} أمبولة`}</span><small>${product.competitor ? '' : escapeHtml(product.batchLot || 'رقم التشغيلة غير متاح')}</small></div>`).join('') || '<p>لا توجد منتجات مسجلة.</p>'}</div></section><section id="source-section" class="source-section"></section>`;
  document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
  dialog.showModal();
  const source = document.querySelector('#source-section');
  if (row.source_kind === 'excel') {
    source.innerHTML = '<p class="muted">هذا السجل مستورد من Excel؛ لا يتوفر ملف أصلي للمعاينة في التخزين.</p>';
  } else if (row.source_storage_path) {
    source.innerHTML = '<button id="open-source" class="button outline">فتح الملف الأصلي (رابط آمن لمدة دقيقة)</button><div id="source-preview"></div>';
    document.querySelector('#open-source').addEventListener('click', () => createSourceUrl(row.source_storage_path, row.id));
  } else {
    source.innerHTML = '<p class="muted">لا يتوفر ملف أصلي لهذا التقرير.</p>';
  }
}

async function createSourceUrl(path, reportId) {
  const preview = document.querySelector('#source-preview');
  if (!preview || !state.session || !supabase) return;
  const thisRequest = ++sourceRequestId;
  const userId = state.session.user.id;
  preview.innerHTML = '<p class="muted">جارٍ إنشاء رابط آمن…</p>';
  const stillCurrent = () => thisRequest === sourceRequestId
    && state.session?.user?.id === userId
    && document.querySelector('#batch-dialog')?.open
    && document.querySelector('#dialog-content')?.querySelector('#source-preview') === preview
    && String(state.rows.find(row => String(row.id) === String(reportId))?.id) === String(reportId);
  try {
    const { data, error } = await supabase.storage.from('hatchery-reports').createSignedUrl(path, 60);
    if (!stillCurrent()) return;
    if (error || !data?.signedUrl) {
      preview.innerHTML = '<p class="alert error">تعذر فتح الملف الأصلي ضمن صلاحيات هذا الحساب.</p>';
      return;
    }
    if (/\.(png|jpe?g|webp|gif)$/i.test(path)) preview.innerHTML = `<img class="source-image" src="${escapeHtml(data.signedUrl)}" alt="الملف الأصلي للتقرير">`;
    else preview.innerHTML = `<a class="button outline" href="${escapeHtml(data.signedUrl)}" target="_blank" rel="noopener noreferrer">عرض / تنزيل الملف</a>`;
  } catch {
    if (stillCurrent()) preview.innerHTML = '<p class="alert error">تعذر فتح الملف الأصلي ضمن صلاحيات هذا الحساب.</p>';
  }
}

function renderLoginConfigError() {
  state.error = 'أعد تحميل الصفحة بعد ضبط بيانات الاتصال.';
  renderLogin();
}

renderShell();
if (!supabaseConfigured) {
  renderLogin();
} else {
  renderLogin();
  supabase.auth.onAuthStateChange((event, session) => {
    state.session = session;
    if (event === 'SIGNED_IN') setTimeout(() => loadDashboard(), 0);
    else if (!session) {
      requestId += 1;
      sourceRequestId += 1;
      state.rows = [];
      state.total = 0;
      state.dateMin = null;
      state.dateMax = null;
      state.refreshedAt = null;
      state.sourceReportCount = 0;
      state.excludedInvalid = 0;
      state.loading = false;
      state.loadingUserId = '';
      state.loadedUserId = '';
      state.selectedProductId = '';
      state.selectedCustomerCode = '';
      state.search = '';
      state.filters = { status: ['accepted'], dateFrom: '', dateTo: '', region: 'all', customerCode: '', productId: '' };
      state.page = 0;
      state.customerMetric = 'birds';
      const dialog = document.querySelector('#batch-dialog');
      if (dialog?.open) dialog.close();
      document.querySelector('#dialog-content')?.replaceChildren();
      renderLogin();
    }
  });
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      state.error = 'تعذر استعادة جلسة الدخول.';
      renderLogin();
    } else if (data.session) {
      state.session = data.session;
      loadDashboard();
    }
  });
}
