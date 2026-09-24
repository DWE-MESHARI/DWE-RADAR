import { DEFAULT_META, DEFAULT_ISSUES, DEFAULT_GALLERY, DEFAULT_DB_THUMBS } from './data.js';
import { getFirebaseDb } from './firebase-db.js';

/* ===================== State ===================== */
let issues = DEFAULT_ISSUES.slice();
let meta = Object.assign({}, DEFAULT_META);
let gallery = JSON.parse(JSON.stringify(DEFAULT_GALLERY));
let currentDocId = null; // id of the saved doc this view currently mirrors, if any
let lastFilteredIssues = []; // same object references as inside `issues`, used by inline row editors
let projectChart = null, categoryChart = null, overviewChart = null, timelineChart = null;
let db = null;
let savedAnalyses = []; // live mirror of the "analyses" collection
let persistTimer = null;

const ORANGE_SHADES = ["#F2801E","#FFB24E","#E06A00","#FFDCAA","#FF9E28","#BD5800","#FFC97D"];
function shadeFor(idx){ return ORANGE_SHADES[idx % ORANGE_SHADES.length]; }

/* Distinct, non-orange colors reserved for data/analytics only (charts, badges, KPIs) — the rest of the UI stays orange & white */
const CATEGORY_COLORS = {
  "إنشائي":  "#2563EB", // blue
  "كهرباء":  "#D97706", // amber
  "سباكة":   "#0891B2", // cyan
  "تشطيبات": "#DB2777", // pink
  "إدارية":  "#7C3AED", // violet
  "سلامة":   "#DC2626", // red
  "أخرى":    "#4B5563"  // slate
};
const SEVERITY_COLORS = { "عالية": "#DC2626", "متوسطة": "#D97706", "منخفضة": "#16A34A" };
const STATUS_COLORS = { "مفتوحة": "#DC2626", "قيد المعالجة": "#D97706", "مغلقة": "#16A34A" };
const CHART_PALETTE = ["#2563EB","#7C3AED","#0D9488","#DB2777","#D97706","#16A34A","#0891B2","#DC2626","#4F46E5","#CA8A04"];
function catColor(cat){ return CATEGORY_COLORS[cat] || CHART_PALETTE[Math.abs(hashStr(cat)) % CHART_PALETTE.length]; }
function severityColor(sev){ return SEVERITY_COLORS[sev] || '#6B7280'; }
function statusColor(st){ return STATUS_COLORS[st] || '#6B7280'; }
function hashStr(s){ let h = 0; for (let i=0;i<(s||'').length;i++){ h = ((h<<5)-h) + s.charCodeAt(i); h |= 0; } return h; }
function projectColor(name){ return CHART_PALETTE[Math.abs(hashStr(name || '')) % CHART_PALETTE.length]; }
function tint(hex, amount){
  // lighten a hex color toward white for chip backgrounds
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * amount); g = Math.round(g + (255 - g) * amount); b = Math.round(b + (255 - b) * amount);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

/* ===================== Classification helpers (used for uploaded files) ===================== */
const CATEGORY_RULES = [
  { cat: "إنشائي", kws: ["خرسانة","شرخ","شروخ","شق طولي","صبة","صبيه","هيكل","تسليح","عمود","لياسة","إنشائي"] },
  { cat: "كهرباء", kws: ["كهرباء","كهربائ","فيش","تمديد كهرب"] },
  { cat: "سباكة", kws: ["مواسير","سباكة","تسرب","خزان","مياه"] },
  { cat: "تشطيبات", kws: ["دهان","بلاط","تشطيب","زجاج","باب","ديكور","نظافة","مخلفات","درابزين","شباك","شبابيك","سكاي لايت"] },
  { cat: "سلامة", kws: ["خطر","خطورة","سلامة","أمان"] },
  { cat: "إدارية", kws: ["سياسة","زيارة","زيارات","بروشور","مخطط","تعميم","موافقة الإدارة","تعاقد","عقد"] }
];
function classifyCategory(text){
  const t = (text || "").toString();
  for (const rule of CATEGORY_RULES){ if (rule.kws.some(k => t.includes(k))) return rule.cat; }
  return "أخرى";
}
function classifySeverity(text){
  const t = (text || "").toString();
  if (["خطر","خطورة","لم أتمكن","غير مقبول","مكسور","خالي تمامًا","خاليان تمامًا"].some(k => t.includes(k))) return "عالية";
  if (["غير مكتمل","غير مركب","غير سليم","مشوه"].some(k => t.includes(k))) return "متوسطة";
  return "متوسطة";
}
function normalizeStatus(text){
  const t = (text || "").toString().trim().toLowerCase();
  if (!t) return "مفتوحة";
  if (["مغلق","تم","closed","done","resolved","معالج"].some(k => t.includes(k))) return "مغلقة";
  if (["قيد","جار","progress","processing","تحت"].some(k => t.includes(k))) return "قيد المعالجة";
  return "مفتوحة";
}

/* ===================== Small utilities ===================== */
function escapeHtml(s){
  return (s || '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtDate(d){
  try { return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year:'numeric', month:'long', day:'numeric' }).format(d); }
  catch(e){ return d.toLocaleDateString(); }
}
function fmtDateShort(d){
  try { return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year:'numeric', month:'short', day:'numeric' }).format(d); }
  catch(e){ return d.toLocaleDateString(); }
}
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._h);
  showToast._h = setTimeout(() => t.classList.remove('show'), 3200);
}
function ensureIssueDefaults(arr){
  (arr || []).forEach(i => {
    if (i.status === undefined) i.status = 'مفتوحة';
    if (i.assignee === undefined) i.assignee = '';
    if (i.dueDate === undefined) i.dueDate = '';
  });
  return arr || [];
}

/* ===================== Tabs ===================== */
document.querySelectorAll('.side-link').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.side-link').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'overview') renderOverview();
  });
});

/* ===================== Rendering: current analysis ===================== */
function renderMeta(){
  document.getElementById('fileMetaLine').textContent = meta.fileName;
  document.getElementById('metaSource').textContent = meta.sourceType;
  document.getElementById('metaSlides').textContent = meta.unitCount + ' ' + meta.unitLabel;
  document.getElementById('metaSourcePrint').textContent = meta.sourceType;
  document.getElementById('metaSlidesPrint').textContent = meta.unitCount + ' ' + meta.unitLabel;
  const now = new Date();
  document.getElementById('metaDate').textContent = fmtDate(now);
  document.getElementById('metaDatePrint').textContent = fmtDate(now);
  document.getElementById('footerDate').textContent = 'أُنشئ في ' + fmtDate(now);
}

function renderKPIs(){
  const total = issues.length;
  const projects = new Set(issues.map(i => i.project));
  const high = issues.filter(i => i.severity === 'عالية').length;
  const closed = issues.filter(i => (i.status || 'مفتوحة') === 'مغلقة').length;
  const catCounts = {};
  issues.forEach(i => catCounts[i.category] = (catCounts[i.category]||0) + 1);
  let topCat = '—', topCount = 0;
  Object.entries(catCounts).forEach(([c,n]) => { if (n > topCount) { topCat = c; topCount = n; } });

  document.getElementById('kpiTotal').textContent = total;
  document.getElementById('kpiTotalSub').textContent = total ? 'عبر ' + projects.size + ' مشروع' : 'لا توجد بيانات';
  document.getElementById('kpiProjects').textContent = projects.size;
  document.getElementById('kpiProjectsSub').textContent = projects.size ? 'مشاريع تحتوي على ملاحظات مسجّلة' : '—';
  document.getElementById('kpiHigh').textContent = high;
  document.getElementById('kpiHighSub').textContent = total ? Math.round((high/total)*100) + '% من إجمالي الملاحظات' : '—';
  document.getElementById('kpiTopCat').textContent = topCat;
  document.getElementById('kpiTopCat').style.color = topCat !== '—' ? catColor(topCat) : '';
  document.getElementById('kpiTopCatSub').textContent = topCount ? topCount + ' ملاحظة في هذه الفئة' : '—';
  document.getElementById('kpiDone').textContent = total ? Math.round((closed/total)*100) + '%' : '0%';
  document.getElementById('kpiDoneSub').textContent = total ? closed + ' من ' + total + ' مغلقة' : '—';
}

function renderStatusSummary(){
  const total = issues.length;
  const counts = { 'مفتوحة': 0, 'قيد المعالجة': 0, 'مغلقة': 0 };
  issues.forEach(i => { const s = i.status || 'مفتوحة'; counts[s] = (counts[s] || 0) + 1; });
  const track = document.getElementById('statusTrack');
  const legend = document.getElementById('statusLegend');
  if (!total){
    track.innerHTML = ''; legend.innerHTML = '<span>لا توجد ملاحظات بعد</span>';
    document.getElementById('statusSummaryPct').textContent = '—';
    return;
  }
  track.innerHTML = Object.entries(counts).map(([st,n]) => n ? '<span style="width:'+(n/total*100)+'%;background:'+statusColor(st)+'"></span>' : '').join('');
  legend.innerHTML = Object.entries(counts).map(([st,n]) => '<span><span class="status-dot" style="background:'+statusColor(st)+'"></span>'+st+': <b>'+n+'</b></span>').join('');
  document.getElementById('statusSummaryPct').textContent = Math.round((counts['مغلقة']/total)*100) + '% منجزة';
}

const TOOLTIP_STYLE = { rtl: true, titleAlign: 'right', bodyAlign: 'right', backgroundColor: '#201F1D', titleColor: '#FFF6EC', bodyColor: '#FFE9CC', padding: 10, cornerRadius: 8, displayColors: true, boxPadding: 4 };
const centerTextPlugin = {
  id: 'centerText',
  afterDraw(chart){
    if (chart.config.type !== 'doughnut' || !chart.config._showCenterText) return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const total = chart.data.datasets[0].data.reduce((a,b) => a+b, 0);
    const cx = (chartArea.left + chartArea.right) / 2, cy = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = "700 24px 'IBM Plex Mono', monospace";
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--ink') || '#201F1D';
    ctx.fillText(total, cx, cy - 9);
    ctx.font = "600 11px 'Tajawal', sans-serif";
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted') || '#8C8985';
    ctx.fillText('ملاحظة', cx, cy + 13);
    ctx.restore();
  }
};
Chart.register(centerTextPlugin);

function renderCharts(){
  const byProject = {};
  issues.forEach(i => byProject[i.project] = (byProject[i.project]||0) + 1);
  const projectEntries = Object.entries(byProject).sort((a,b) => b[1]-a[1]);

  const byCat = {};
  issues.forEach(i => byCat[i.category] = (byCat[i.category]||0) + 1);
  const catEntries = Object.entries(byCat).sort((a,b) => b[1]-a[1]);

  Chart.defaults.font.family = "'Tajawal', sans-serif";
  Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--muted') || '#8C8985';

  if (projectChart) { projectChart.destroy(); projectChart = null; }
  if (categoryChart) { categoryChart.destroy(); categoryChart = null; }

  const projWrap = document.getElementById('projectChart').closest('.chart-wrap');
  projWrap.innerHTML = '<canvas id="projectChart"></canvas>';
  const projCtx = document.getElementById('projectChart').getContext('2d');
  if (projectEntries.length === 0){
    projWrap.innerHTML = '<div class="empty-note">لا توجد بيانات لعرضها</div>';
  } else {
    projectChart = new Chart(projCtx, {
      type: 'bar',
      data: { labels: projectEntries.map(e => e[0]), datasets: [{ data: projectEntries.map(e => e[1]), backgroundColor: projectEntries.map(e => projectColor(e[0])), borderRadius: 8, borderSkipped: false, maxBarThickness: 24, categoryPercentage: 0.65 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: { legend: { display: false }, tooltip: TOOLTIP_STYLE },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#FFDFB2' } }, y: { grid: { display: false }, ticks: { font: { weight: '600' } } } }
      }
    });
  }

  const catWrap = document.getElementById('categoryChart').closest('.chart-wrap');
  catWrap.innerHTML = '<canvas id="categoryChart"></canvas>';
  const catCtx = document.getElementById('categoryChart').getContext('2d');
  if (catEntries.length === 0){
    catWrap.innerHTML = '<div class="empty-note">لا توجد بيانات لعرضها</div>';
  } else {
    categoryChart = new Chart(catCtx, {
      type: 'doughnut',
      data: { labels: catEntries.map(e => e[0]), datasets: [{ data: catEntries.map(e => e[1]), backgroundColor: catEntries.map(e => catColor(e[0])), borderWidth: 3, borderColor: getComputedStyle(document.body).getPropertyValue('--card') || '#fff', hoverOffset: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: { legend: { position: 'bottom', rtl: true, labels: { boxWidth: 10, padding: 14, font: { size: 11.5, weight: '600' } } }, tooltip: TOOLTIP_STYLE }
      }
    });
    categoryChart.config._showCenterText = true;
    categoryChart.update();
  }
}

function renderGallery(){
  const wrap = document.getElementById('galleryGrid');
  const section = document.getElementById('gallerySection');
  const entries = [];
  Object.entries(gallery || {}).forEach(([project, imgs]) => {
    (imgs || []).forEach(img => entries.push({ project, ...img }));
  });
  if (!entries.length){ section.style.display = 'none'; wrap.innerHTML = ''; return; }
  section.style.display = '';
  wrap.innerHTML = entries.map(e => (
    '<div class="gallery-item">' +
      '<img src="' + e.dataUrl + '" alt="' + escapeHtml(e.caption || e.project) + '" loading="lazy">' +
      '<div class="gi-body"><div class="gi-proj" style="color:' + projectColor(e.project) + '"><span class="proj-dot" style="background:' + projectColor(e.project) + '"></span>' + escapeHtml(e.project) + '</div><div class="gi-cap">' + escapeHtml(e.caption || '') + '</div></div>' +
    '</div>'
  )).join('');
}

function renderRecommendations(){
  const seen = new Set();
  const recs = [];
  issues.forEach(i => { if (i.action && !seen.has(i.action)){ seen.add(i.action); recs.push({ action: i.action, project: i.project }); } });
  const wrap = document.getElementById('recList');
  wrap.innerHTML = '';
  if (recs.length === 0){ wrap.innerHTML = '<div class="empty-note">لم يتم رصد إجراءات مقترحة صريحة في هذا الملف</div>'; return; }
  recs.forEach((r, idx) => {
    const div = document.createElement('div');
    div.className = 'rec-item';
    div.style.borderInlineStart = '4px solid ' + projectColor(r.project);
    div.innerHTML = '<span class="rn" style="color:'+projectColor(r.project)+'">' + String(idx+1).padStart(2,'0') + '</span><span>' + escapeHtml(r.action) + '<span class="rp" style="color:'+projectColor(r.project)+'">' + escapeHtml(r.project) + '</span></span>';
    wrap.appendChild(div);
  });
}

function populateFilters(){
  const projSel = document.getElementById('projectFilter');
  const catSel = document.getElementById('categoryFilter');
  const projects = [...new Set(issues.map(i => i.project))];
  const cats = [...new Set(issues.map(i => i.category))];
  projSel.innerHTML = '<option value="">كل المشاريع</option>' + projects.map(p => '<option value="'+escapeHtml(p)+'">'+escapeHtml(p)+'</option>').join('');
  catSel.innerHTML = '<option value="">كل الفئات</option>' + cats.map(c => '<option value="'+escapeHtml(c)+'">'+escapeHtml(c)+'</option>').join('');
}

function severityBadge(sev){
  const cls = sev === 'عالية' ? 'badge-high' : (sev === 'منخفضة' ? 'badge-low' : 'badge-mid');
  return '<span class="badge dot '+cls+'">'+escapeHtml(sev || 'غير محددة')+'</span>';
}

function statusSelectHtml(issue, idx){
  const st = issue.status || 'مفتوحة';
  const opts = ['مفتوحة','قيد المعالجة','مغلقة'].map(s => '<option value="'+s+'"'+(s===st?' selected':'')+'>'+s+'</option>').join('');
  return '<select class="status-select" data-row-idx="'+idx+'" style="color:'+statusColor(st)+';border-color:'+statusColor(st)+'66">'+opts+'</select>';
}

function isOverdue(issue){
  if (!issue.dueDate || issue.status === 'مغلقة') return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(issue.dueDate);
  return !isNaN(due) && due < today;
}

function renderTable(){
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const pf = document.getElementById('projectFilter').value;
  const cf = document.getElementById('categoryFilter').value;
  const sf = document.getElementById('severityFilter').value;
  const stf = document.getElementById('statusFilter').value;

  const filtered = issues.filter(i => {
    if (pf && i.project !== pf) return false;
    if (cf && i.category !== cf) return false;
    if (sf && i.severity !== sf) return false;
    if (stf && (i.status || 'مفتوحة') !== stf) return false;
    if (search){
      const hay = (i.project + ' ' + i.description + ' ' + i.cause + ' ' + i.action + ' ' + (i.assignee||'')).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
  lastFilteredIssues = filtered;

  const body = document.getElementById('tableBody');
  body.innerHTML = filtered.map((i, idx) => (
    '<tr>' +
      '<td class="proj"><span class="proj-dot" style="background:' + projectColor(i.project) + '"></span>' + escapeHtml(i.project) + '</td>' +
      '<td><span class="cat-chip" style="background:' + tint(catColor(i.category), 0.85) + ';color:' + catColor(i.category) + '">' + escapeHtml(i.category) + '</span></td>' +
      '<td>' + severityBadge(i.severity) + '</td>' +
      '<td>' + statusSelectHtml(i, idx) + '</td>' +
      '<td class="desc">' + escapeHtml(i.description) + '</td>' +
      '<td style="min-width:150px">' +
        '<input type="text" class="mini-input" data-field="assignee" data-row-idx="'+idx+'" placeholder="المسؤول" value="'+escapeHtml(i.assignee||'')+'">' +
        '<input type="date" class="mini-input" data-field="dueDate" data-row-idx="'+idx+'" value="'+escapeHtml(i.dueDate||'')+'" style="'+(isOverdue(i)?'color:#DC2626;border-color:#DC2626':'')+'">' +
      '</td>' +
      '<td class="cause">' + (i.cause ? escapeHtml(i.cause) : '—') + '</td>' +
      '<td class="action">' + (i.action ? escapeHtml(i.action) : '—') + '</td>' +
      '<td class="no-print"><button class="row-edit-btn" data-row-idx="'+idx+'" type="button" title="تعديل الملاحظة">✎</button><button class="row-del-btn" data-row-idx="'+idx+'" type="button" title="حذف الملاحظة">✕</button></td>' +
    '</tr>'
  )).join('') || '<tr><td colspan="9"><div class="empty-note">لا توجد نتائج مطابقة للتصفية الحالية</div></td></tr>';

  document.getElementById('filterCount').textContent = 'عرض ' + filtered.length + ' من ' + issues.length + ' ملاحظة';

  body.querySelectorAll('.status-select').forEach(el => el.addEventListener('change', onInlineFieldChange));
  body.querySelectorAll('.mini-input').forEach(el => el.addEventListener('change', onInlineFieldChange));
  body.querySelectorAll('.row-del-btn').forEach(el => el.addEventListener('click', onRowDelete));
  body.querySelectorAll('.row-edit-btn').forEach(el => el.addEventListener('click', onRowEdit));
}

function onInlineFieldChange(e){
  const el = e.target;
  const idx = +el.dataset.rowIdx;
  const issue = lastFilteredIssues[idx];
  if (!issue) return;
  const field = el.classList.contains('status-select') ? 'status' : el.dataset.field;
  issue[field] = el.value;
  if (field === 'status'){
    el.style.color = statusColor(el.value);
    el.style.borderColor = statusColor(el.value) + '66';
    renderKPIs();
    renderStatusSummary();
  }
  if (field === 'dueDate'){
    el.style.color = isOverdue(issue) ? '#DC2626' : '';
    el.style.borderColor = isOverdue(issue) ? '#DC2626' : '';
  }
  persistIssuesToDb();
}

function onRowDelete(e){
  const idx = +e.currentTarget.dataset.rowIdx;
  const issue = lastFilteredIssues[idx];
  if (!issue) return;
  if (!confirm('حذف هذه الملاحظة نهائيًا من هذا التحليل؟')) return;
  const pos = issues.indexOf(issue);
  if (pos > -1) issues.splice(pos, 1);
  renderAll();
  persistIssuesToDb();
  showToast('تم حذف الملاحظة');
}

function onRowEdit(e){
  const idx = +e.currentTarget.dataset.rowIdx;
  const issue = lastFilteredIssues[idx];
  if (!issue) return;
  openIssueModal(issue);
}

function persistIssuesToDb(){
  if (!db || !currentDocId) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try { await db.collection('analyses').doc(currentDocId).update({ issues }); }
    catch(e){ console.warn('persist failed', e); }
  }, 500);
}

function renderAll(){
  renderMeta();
  renderKPIs();
  renderStatusSummary();
  renderCharts();
  renderGallery();
  renderRecommendations();
  populateFilters();
  renderTable();
}

['searchInput','projectFilter','categoryFilter','severityFilter','statusFilter'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderTable);
  document.getElementById(id).addEventListener('change', renderTable);
});

/* ===================== Rendering: overview tab (aggregated across saved library) ===================== */
function renderTimelineChart(source){
  const sorted = source.slice().sort((a,b) => new Date(a.savedAt||0) - new Date(b.savedAt||0));
  if (timelineChart) { timelineChart.destroy(); timelineChart = null; }
  const wrap = document.getElementById('timelineChart').closest('.chart-wrap');
  wrap.innerHTML = '<canvas id="timelineChart"></canvas>';
  if (sorted.length < 1){ wrap.innerHTML = '<div class="empty-note">لا توجد بيانات كافية بعد لعرض اتجاه زمني</div>'; return; }
  const ctx = document.getElementById('timelineChart').getContext('2d');
  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sorted.map(r => fmtDateShort(r.savedAt ? new Date(r.savedAt) : new Date())),
      datasets: [
        { label: 'إجمالي الملاحظات', data: sorted.map(r => (r.issues||[]).length), borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,.12)', tension: .3, fill: true, pointRadius: 3, pointBackgroundColor: '#2563EB' },
        { label: 'عالية الخطورة', data: sorted.map(r => (r.issues||[]).filter(i => i.severity==='عالية').length), borderColor: '#DC2626', backgroundColor: 'rgba(220,38,38,.10)', tension: .3, fill: true, pointRadius: 3, pointBackgroundColor: '#DC2626' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: { legend: { position: 'bottom', rtl: true, labels: { boxWidth: 10, font: { size: 11.5, weight: '600' } } }, tooltip: TOOLTIP_STYLE },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#FFDFB2' } } }
    }
  });
}

function dedupeAnalyses(source){
  // Keep only the most recent saved record per fileName, so re-uploading the same file
  // doesn't inflate the overview totals with duplicate counts.
  const byName = new Map();
  source.forEach(rec => {
    const key = (rec.fileName || '').trim().toLowerCase();
    const savedAt = rec.savedAt ? new Date(rec.savedAt) : new Date(0);
    const existing = byName.get(key);
    if (!existing || savedAt > existing._savedAtDate) byName.set(key, Object.assign({}, rec, { _savedAtDate: savedAt }));
  });
  return [...byName.values()];
}

function renderOverview(){
  const rawSource = savedAnalyses.length ? savedAnalyses : (db ? [] : [{ fileName: meta.fileName, issues, savedAt: new Date().toISOString() }]);
  const source = dedupeAnalyses(rawSource);

  const projMap = {}; // project -> {total, high, mid, low, sources:Set, last:Date}
  let totalIssues = 0, totalHigh = 0;

  source.forEach(rec => {
    const savedAt = rec.savedAt ? new Date(rec.savedAt) : new Date();
    (rec.issues || []).forEach(i => {
      totalIssues++;
      if (i.severity === 'عالية') totalHigh++;
      if (!projMap[i.project]) projMap[i.project] = { total: 0, high: 0, mid: 0, low: 0, sources: new Set(), last: savedAt };
      const p = projMap[i.project];
      p.total++;
      if (i.severity === 'عالية') p.high++; else if (i.severity === 'منخفضة') p.low++; else p.mid++;
      p.sources.add(rec.fileName);
      if (savedAt > p.last) p.last = savedAt;
    });
  });

  document.getElementById('ovFiles').textContent = source.length;
  document.getElementById('ovTotal').textContent = totalIssues;
  document.getElementById('ovTotalSub').textContent = totalIssues ? 'عبر ' + Object.keys(projMap).length + ' مشروع' : '—';
  document.getElementById('ovProjects').textContent = Object.keys(projMap).length;
  document.getElementById('ovHigh').textContent = totalHigh;
  document.getElementById('ovHighSub').textContent = totalIssues ? Math.round((totalHigh/totalIssues)*100) + '% من الإجمالي' : '—';

  renderTimelineChart(source);

  const rows = Object.entries(projMap).sort((a,b) => b[1].total - a[1].total);

  if (overviewChart) { overviewChart.destroy(); overviewChart = null; }
  const wrap = document.getElementById('overviewChart').closest('.chart-wrap');
  wrap.innerHTML = '<canvas id="overviewChart"></canvas>';
  if (rows.length){
    const ctx = document.getElementById('overviewChart').getContext('2d');
    overviewChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: rows.map(r => r[0]),
        datasets: [
          { label: 'عالية', data: rows.map(r => r[1].high), backgroundColor: SEVERITY_COLORS['عالية'], stack: 's', borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 6, bottomRight: 6 }, borderSkipped: false },
          { label: 'متوسطة', data: rows.map(r => r[1].mid), backgroundColor: SEVERITY_COLORS['متوسطة'], stack: 's' },
          { label: 'منخفضة', data: rows.map(r => r[1].low), backgroundColor: SEVERITY_COLORS['منخفضة'], stack: 's', borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 }, borderSkipped: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: { legend: { position: 'bottom', rtl: true, labels: { boxWidth: 10, font: { size: 11.5, weight: '600' } } }, tooltip: TOOLTIP_STYLE },
        scales: { x: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, maxRotation: 40, minRotation: 0, font: { weight: '600' } } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#FFDFB2' } } }
      }
    });
  } else {
    wrap.innerHTML = '<div class="empty-note">لا توجد بيانات محفوظة بعد</div>';
  }

  const maxTotal = rows.length ? rows[0][1].total : 1;
  document.getElementById('overviewTableBody').innerHTML = rows.map((r, idx) => {
    const [project, s] = r;
    const pct = Math.max(6, Math.round((s.total / maxTotal) * 100));
    return '<tr>' +
      '<td class="rank">' + (idx+1) + '</td>' +
      '<td class="proj"><span class="proj-dot" style="background:' + projectColor(project) + '"></span>' + escapeHtml(project) + '</td>' +
      '<td><div style="display:flex;align-items:center;gap:8px;min-width:110px"><span class="mono">' + s.total + '</span><div class="mini-bar-track"><div class="mini-bar-fill" style="width:'+pct+'%"></div></div></div></td>' +
      '<td>' + s.high + '</td><td>' + s.mid + '</td><td>' + s.low + '</td>' +
      '<td>' + s.sources.size + '</td>' +
      '<td>' + fmtDateShort(s.last) + '</td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="8"><div class="empty-note">لا توجد بيانات بعد</div></td></tr>';
}

/* ===================== Rendering: notes library ===================== */
function renderNotesLibrary(){
  const grid = document.getElementById('notesGrid');
  document.getElementById('notesCountBadge').textContent = savedAnalyses.length ? '(' + savedAnalyses.length + ')' : '';

  if (!db){
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
      '<div>الحفظ التلقائي غير متاح في هذا العرض. افتح اللوحة من داخل صفحتها المنشورة على claude.ai حتى تُحفظ الملفات في قسم الملاحظات.</div>' +
    '</div>';
    return;
  }
  if (!savedAnalyses.length){
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
      '<div>لا توجد ملفات محفوظة بعد. عند تحليل أي ملف جديد سيُحفظ هنا تلقائيًا.</div>' +
    '</div>';
    return;
  }
  grid.innerHTML = savedAnalyses.map(rec => {
    const total = (rec.issues||[]).length;
    const high = (rec.issues||[]).filter(i => i.severity === 'عالية').length;
    const projCount = new Set((rec.issues||[]).map(i => i.project)).size;
    const d = rec.savedAt ? new Date(rec.savedAt) : null;
    return '<div class="note-card">' +
      '<div class="nc-head"><div class="nc-name">' + escapeHtml(rec.fileName || 'ملف بدون اسم') + '</div><span class="nc-type">' + escapeHtml(rec.sourceType || '') + '</span></div>' +
      '<div class="nc-meta">' + (d ? 'حُفظ في ' + fmtDateShort(d) : '') + '</div>' +
      '<div class="nc-stats"><span><b>' + total + '</b> ملاحظة</span><span><b>' + projCount + '</b> مشروع</span><span><b>' + high + '</b> عالية الخطورة</span></div>' +
      '<div class="nc-actions">' +
        '<button class="btn btn-ghost" type="button" data-view="' + escapeHtml(rec.id) + '">عرض</button>' +
        '<button class="btn btn-ghost" type="button" data-share="' + escapeHtml(rec.id) + '">مشاركة</button>' +
        '<button class="btn btn-danger" type="button" data-del="' + escapeHtml(rec.id) + '">حذف</button>' +
      '</div>' +
    '</div>';
  }).join('');

  grid.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => loadSavedAnalysis(btn.dataset.view)));
  grid.querySelectorAll('[data-share]').forEach(btn => btn.addEventListener('click', () => openShareModal(btn.dataset.share)));
  grid.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => deleteSavedAnalysis(btn.dataset.del)));
}

function loadSavedAnalysis(id){
  const rec = savedAnalyses.find(r => r.id === id);
  if (!rec) return;
  issues = ensureIssueDefaults((rec.issues || []).slice());
  meta = { fileName: rec.fileName, sourceType: rec.sourceType, unitLabel: rec.unitLabel, unitCount: rec.unitCount };
  gallery = {};
  (rec.thumbs || []).forEach(t => { (gallery[t.project] = gallery[t.project] || []).push({ caption: t.caption, dataUrl: t.dataUrl }); });
  currentDocId = id;
  document.getElementById('resetBtn').style.display = 'inline-flex';
  document.querySelectorAll('.side-link').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.side-link[data-tab="current"]').classList.add('active');
  document.getElementById('panel-current').classList.add('active');
  renderAll();
  showToast('تم فتح التحليل المحفوظ: ' + rec.fileName);
}

async function deleteSavedAnalysis(id){
  if (!db) return;
  if (!confirm('هل تريد حذف هذا الملف من قسم الملاحظات؟\n\nتنبيه: أي رابط مشاركة أو رمز QR تم إنشاؤه لهذا التحليل سيتوقف عن العمل بعد الحذف. لا يمكن التراجع عن هذا الإجراء.')) return;
  try {
    await db.collection('analyses').doc(id).delete();
    if (currentDocId === id) currentDocId = null;
    showToast('تم الحذف');
  } catch(e){ console.error(e); showToast('تعذّر الحذف'); }
}

/* ===================== db (persistent "قسم الملاحظات") ===================== */
async function initDb(){
  try {
    db = await getFirebaseDb();
  } catch(e){ db = null; }

  if (!db){
    document.getElementById('saveNote').innerHTML = '';
    renderNotesLibrary();
    return;
  }

  document.getElementById('saveNote').innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
    'كل ملف يتم تحليله يُحفظ تلقائيًا في قسم الملاحظات ويظهر في لوحة المتابعة الشاملة';

  // Seed the default analysis once, idempotently, so the library and overview aren't empty on first open.
  try {
    const seedRef = db.collection('analyses').doc('default-seed');
    const snap = await seedRef.get();
    if (!snap.exists){
      await seedRef.set({
        fileName: DEFAULT_META.fileName,
        sourceType: DEFAULT_META.sourceType,
        unitLabel: DEFAULT_META.unitLabel,
        unitCount: DEFAULT_META.unitCount,
        issues: DEFAULT_ISSUES,
        thumbs: DEFAULT_DB_THUMBS,
        savedAt: new Date().toISOString()
      });
    }
    if (currentDocId === null) currentDocId = 'default-seed';
  } catch(e){ console.warn('seed skipped', e); }

  await handleDeepLink();

  db.collection('analyses').orderBy('savedAt','desc').limit(200).onSnapshot(
    snap => {
      savedAnalyses = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      renderNotesLibrary();
      if (document.getElementById('panel-overview').classList.contains('active')) renderOverview();
    },
    err => { console.warn('analyses subscription error', err); }
  );
}

async function handleDeepLink(){
  const openId = new URLSearchParams(window.location.search).get('open');
  if (!openId || !db || openId === 'default-seed') return;
  try {
    const snap = await db.collection('analyses').doc(openId).get();
    if (snap && snap.exists){
      const rec = Object.assign({ id: openId }, snap.data());
      issues = ensureIssueDefaults((rec.issues || []).slice());
      meta = { fileName: rec.fileName, sourceType: rec.sourceType, unitLabel: rec.unitLabel, unitCount: rec.unitCount };
      gallery = {};
      (rec.thumbs || []).forEach(t => { (gallery[t.project] = gallery[t.project] || []).push({ caption: t.caption, dataUrl: t.dataUrl }); });
      currentDocId = openId;
      document.getElementById('resetBtn').style.display = 'inline-flex';
      renderAll();
      showToast('تم فتح التحليل المشارك: ' + rec.fileName);
    }
  } catch(e){ console.warn('deep link load failed', e); }
}

async function saveCurrentAnalysisToDb(){
  if (!db) return;
  try {
    const thumbs = [];
    Object.entries(gallery || {}).forEach(([project, imgs]) => {
      (imgs || []).slice(0, 1).forEach(img => { if (thumbs.length < 4) thumbs.push({ project, caption: img.caption, dataUrl: img.smallDataUrl || img.dataUrl }); });
    });
    const payload = {
      fileName: meta.fileName,
      sourceType: meta.sourceType,
      unitLabel: meta.unitLabel,
      unitCount: meta.unitCount,
      issues,
      thumbs,
      savedAt: new Date().toISOString()
    };
    // Upsert: re-analyzing a file with the same name updates its existing record instead of
    // creating a duplicate entry (keeps the notes library and overview totals accurate).
    const existing = savedAnalyses.find(r => (r.fileName || '').trim().toLowerCase() === (meta.fileName || '').trim().toLowerCase());
    if (existing){
      await db.collection('analyses').doc(existing.id).update(payload);
      currentDocId = existing.id;
    } else {
      const ref = await db.collection('analyses').add(payload);
      currentDocId = ref.id;
    }
    showToast('تم حفظ التحليل في قسم الملاحظات');
  } catch(e){
    console.error(e);
    showToast('تعذّر الحفظ التلقائي لهذا الملف');
  }
}

/* ===================== File parsing ===================== */
function setStatus(msg){
  const el = document.getElementById('statusLine');
  const txt = document.getElementById('statusText');
  if (msg){ txt.textContent = msg; el.classList.add('show'); } else { el.classList.remove('show'); }
}

function stripXmlText(xml){
  const matches = xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [];
  return matches.map(m => m.replace(/<a:t>|<\/a:t>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'"));
}
function looksLikeProjectName(line){
  const t = line.trim();
  if (!t || t.length > 40) return false;
  return /^(مشروع|سرايا|تالا|فيلا|برج|مجمع)\b/.test(t);
}

function resizeBlobToDataUrl(blob, maxWidth, quality){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const imgEl = new Image();
    imgEl.onload = () => {
      try {
        let w = imgEl.width, h = imgEl.height;
        if (w > maxWidth){ h = Math.round(h * (maxWidth / w)); w = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch(err){ URL.revokeObjectURL(url); reject(err); }
    };
    imgEl.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    imgEl.src = url;
  });
}

async function parsePptx(file){
  const zip = await JSZip.loadAsync(file);
  const slideFiles = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a,b) => parseInt(a.match(/slide(\d+)\.xml/)[1],10) - parseInt(b.match(/slide(\d+)\.xml/)[1],10));

  // Pass 1: figure out which media files are decorative/template (referenced on many slides) vs. real photos
  const relCounts = {};
  const slideMedia = {};
  for (const path of slideFiles){
    const relPath = path.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
    const relFile = zip.files[relPath];
    const refs = [];
    if (relFile){
      const relXml = await relFile.async('string');
      const matches = relXml.match(/Target="\.\.\/media\/[^"]+"/g) || [];
      matches.forEach(m => {
        const name = m.replace('Target="../media/','').replace('"','');
        if (/\.(jpe?g|png)$/i.test(name)){ refs.push(name); relCounts[name] = (relCounts[name]||0) + 1; }
      });
    }
    slideMedia[path] = refs;
  }
  const keepSet = new Set(Object.keys(relCounts).filter(name => relCounts[name] <= Math.max(2, Math.ceil(slideFiles.length * 0.25))));

  // Pass 2: walk slides in order, extracting text (building issues) and collecting a handful of real photos
  const parsedIssues = [];
  const galleryOut = {};
  let currentProject = 'ملاحظات عامة';
  let imagesKept = 0;
  const MAX_IMAGES = 8, MAX_PER_PROJECT = 2;

  for (const path of slideFiles){
    const xml = await zip.files[path].async('string');
    const lines = stripXmlText(xml).map(l => l.trim()).filter(Boolean);
    for (const line of lines){
      if (looksLikeProjectName(line)){ currentProject = line.replace(/^مشروع\s*/, '').trim(); continue; }
      const cleaned = line.replace(/^[\d١٢٣٤٥٦٧٨٩٠]+[\-\.\)]\s*/, '').trim();
      if (cleaned.length < 8) continue;
      if (/^(الملاحظة|السبب المحتمل|الإجراء المقترح)\s*:/.test(cleaned)){
        const [label, ...rest] = cleaned.split(':');
        const val = rest.join(':').trim();
        const last = parsedIssues[parsedIssues.length - 1];
        if (last){
          if (label.includes('السبب')) last.cause = val;
          else if (label.includes('الإجراء')) last.action = val;
          else parsedIssues.push({ project: currentProject, category: classifyCategory(val), severity: classifySeverity(val), description: val, cause: '', action: '', status: 'مفتوحة', assignee: '', dueDate: '' });
          continue;
        }
      }
      parsedIssues.push({ project: currentProject, category: classifyCategory(cleaned), severity: classifySeverity(cleaned), description: cleaned, cause: '', action: '', status: 'مفتوحة', assignee: '', dueDate: '' });
    }

    if (imagesKept < MAX_IMAGES){
      const perProjectCount = (galleryOut[currentProject] || []).length;
      const candidates = (slideMedia[path] || []).filter(name => keepSet.has(name));
      for (const name of candidates){
        if (imagesKept >= MAX_IMAGES) break;
        if ((galleryOut[currentProject] || []).length >= MAX_PER_PROJECT) break;
        const mediaFile = zip.files['ppt/media/' + name];
        if (!mediaFile) continue;
        try {
          const blob = await mediaFile.async('blob');
          const dataUrl = await resizeBlobToDataUrl(blob, 640, 0.6);
          const smallDataUrl = await resizeBlobToDataUrl(blob, 220, 0.45);
          (galleryOut[currentProject] = galleryOut[currentProject] || []).push({ caption: 'صورة من الملف — ' + currentProject, dataUrl, smallDataUrl });
          imagesKept++;
        } catch(e){ /* skip unreadable image */ }
      }
    }
  }

  return { issues: parsedIssues, gallery: galleryOut, unitCount: slideFiles.length, unitLabel: 'شريحة', sourceType: 'عرض تقديمي PowerPoint' };
}

function findHeaderIndex(headers, candidates){
  for (let i = 0; i < headers.length; i++){
    const h = (headers[i] || '').toString().trim().toLowerCase();
    if (candidates.some(c => h.includes(c))) return i;
  }
  return -1;
}

async function parseSpreadsheet(file){
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
  if (!rows.length) return { issues: [], gallery: {}, unitCount: 0, unitLabel: 'صف', sourceType: 'ملف Excel' };

  const headers = rows[0];
  const idx = {
    project: findHeaderIndex(headers, ['مشروع','project']),
    category: findHeaderIndex(headers, ['فئة','نوع','category','type']),
    severity: findHeaderIndex(headers, ['خطورة','أهمية','severity','priority']),
    description: findHeaderIndex(headers, ['ملاحظة','وصف','description','note','issue']),
    cause: findHeaderIndex(headers, ['سبب','cause','reason']),
    action: findHeaderIndex(headers, ['إجراء','توصية','action','recommendation']),
    status: findHeaderIndex(headers, ['حالة','status']),
    assignee: findHeaderIndex(headers, ['مسؤول','المكلف','assignee','owner']),
    dueDate: findHeaderIndex(headers, ['موعد','استحقاق','due date','deadline'])
  };
  const hasHeaderMap = idx.description !== -1 || idx.project !== -1;
  const dataRows = hasHeaderMap ? rows.slice(1) : rows;

  const parsedIssues = dataRows
    .filter(r => r.some(c => (c||'').toString().trim() !== ''))
    .map(r => {
      let description, project, category, severity, cause, action, status, assignee, dueDate;
      if (hasHeaderMap){
        description = idx.description !== -1 ? r[idx.description] : r.join(' — ');
        project = idx.project !== -1 ? r[idx.project] : 'غير محدد';
        category = idx.category !== -1 && r[idx.category] ? r[idx.category] : classifyCategory(description);
        severity = idx.severity !== -1 && r[idx.severity] ? r[idx.severity] : classifySeverity(description);
        cause = idx.cause !== -1 ? r[idx.cause] : '';
        action = idx.action !== -1 ? r[idx.action] : '';
        status = idx.status !== -1 ? normalizeStatus(r[idx.status]) : 'مفتوحة';
        assignee = idx.assignee !== -1 ? r[idx.assignee] : '';
        dueDate = idx.dueDate !== -1 ? r[idx.dueDate] : '';
      } else {
        description = r.filter(c => (c||'').toString().trim() !== '').join(' — ');
        project = r[0] || 'غير محدد';
        category = classifyCategory(description);
        severity = classifySeverity(description);
        cause = ''; action = ''; status = 'مفتوحة'; assignee = ''; dueDate = '';
      }
      return {
        project: (project || 'غير محدد').toString().trim(),
        category: (category || 'أخرى').toString().trim(),
        severity: (severity || 'متوسطة').toString().trim(),
        description: (description || '').toString().trim(),
        cause: (cause || '').toString().trim(),
        action: (action || '').toString().trim(),
        status: (status || 'مفتوحة').toString().trim(),
        assignee: (assignee || '').toString().trim(),
        dueDate: (dueDate || '').toString().trim()
      };
    })
    .filter(i => i.description);

  return { issues: parsedIssues, gallery: {}, unitCount: dataRows.length, unitLabel: 'صف', sourceType: 'ملف Excel' };
}

async function handleFile(file){
  if (!file) return;
  const name = file.name || 'ملف مرفوع';
  const ext = name.split('.').pop().toLowerCase();
  setStatus('جاري تحليل «' + name + '»…');
  document.getElementById('printBtn').setAttribute('disabled','disabled');
  try {
    let result;
    if (ext === 'pptx') result = await parsePptx(file);
    else if (['xlsx','xls','csv'].includes(ext)) result = await parseSpreadsheet(file);
    else { setStatus(''); alert('صيغة الملف غير مدعومة. الرجاء رفع ملف .pptx أو .xlsx أو .csv'); document.getElementById('printBtn').removeAttribute('disabled'); return; }

    if (!result.issues.length){
      setStatus('');
      alert('تم فتح الملف، لكن لم يتم التعرف على ملاحظات قابلة للتحليل داخله.');
      document.getElementById('printBtn').removeAttribute('disabled');
      return;
    }

    issues = ensureIssueDefaults(result.issues);
    gallery = result.gallery || {};
    meta = { fileName: name, sourceType: result.sourceType, unitLabel: result.unitLabel, unitCount: result.unitCount };
    currentDocId = null;
    document.getElementById('resetBtn').style.display = 'inline-flex';
    renderAll();
    setStatus('تم تحليل «' + name + '» بنجاح — ' + issues.length + ' ملاحظة');
    await saveCurrentAnalysisToDb();
    setTimeout(() => setStatus(''), 3500);
  } catch(err){
    console.error(err);
    setStatus('');
    alert('تعذّر تحليل هذا الملف. تأكد أنه غير محمي بكلمة مرور وأن الصيغة صحيحة.');
  }
  document.getElementById('printBtn').removeAttribute('disabled');
}

/* ===================== Wiring ===================== */
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
document.getElementById('pickBtn').addEventListener('click', () => fileInput.click());
document.getElementById('uploadBtn').addEventListener('click', () => {
  document.querySelectorAll('.side-link').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.side-link[data-tab="current"]').classList.add('active');
  document.getElementById('panel-current').classList.add('active');
  fileInput.click();
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

['dragenter','dragover'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave','drop'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });

document.getElementById('resetBtn').addEventListener('click', () => {
  issues = ensureIssueDefaults(DEFAULT_ISSUES.slice());
  meta = Object.assign({}, DEFAULT_META);
  gallery = JSON.parse(JSON.stringify(DEFAULT_GALLERY));
  currentDocId = db ? 'default-seed' : null;
  document.getElementById('resetBtn').style.display = 'none';
  renderAll();
});

document.getElementById('printBtn').addEventListener('click', () => window.print());

function currentFilteredIssues(){
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const pf = document.getElementById('projectFilter').value;
  const cf = document.getElementById('categoryFilter').value;
  const sf = document.getElementById('severityFilter').value;
  const stf = document.getElementById('statusFilter').value;
  return issues.filter(i => {
    if (pf && i.project !== pf) return false;
    if (cf && i.category !== cf) return false;
    if (sf && i.severity !== sf) return false;
    if (stf && (i.status || 'مفتوحة') !== stf) return false;
    if (search){
      const hay = (i.project + ' ' + i.description + ' ' + i.cause + ' ' + i.action + ' ' + (i.assignee||'')).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function toCsv(rows){
  const headers = ['المشروع','الفئة','الخطورة','الحالة','المسؤول','الموعد المستهدف','الملاحظة','السبب المحتمل','الإجراء المقترح'];
  const esc = v => '"' + (v || '').toString().replace(/"/g,'""') + '"';
  const lines = [headers.map(esc).join(',')];
  rows.forEach(i => lines.push([i.project,i.category,i.severity,i.status||'مفتوحة',i.assignee||'',i.dueDate||'',i.description,i.cause,i.action].map(esc).join(',')));
  return '\uFEFF' + lines.join('\r\n');
}

document.getElementById('exportCsvBtn').addEventListener('click', () => {
  const rows = currentFilteredIssues();
  if (!rows.length){ showToast('لا توجد بيانات لتصديرها'); return; }
  const csv = toCsv(rows);
  const safeName = (meta.fileName || 'تقرير').replace(/\.[^.]+$/, '');
  downloadTextFile(safeName + ' - سجل الملاحظات.csv', csv);
  showToast('تم تصدير الملف بنجاح');
});

function downloadTextFile(filename, text){
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ===================== Manual "add issue" modal ===================== */
let editingIssue = null;

function populateCategorySelect(){
  const sel = document.getElementById('fCategory');
  sel.innerHTML = Object.keys(CATEGORY_COLORS).map(c => '<option value="'+c+'">'+c+'</option>').join('');
}
function populateProjectDatalist(){
  const dl = document.getElementById('projectListDatalist');
  const projects = [...new Set(issues.map(i => i.project))];
  dl.innerHTML = projects.map(p => '<option value="'+escapeHtml(p)+'">').join('');
}
function openIssueModal(issueToEdit){
  editingIssue = issueToEdit || null;
  document.getElementById('issueModalTitle').textContent = editingIssue ? 'تعديل الملاحظة' : 'إضافة ملاحظة جديدة';
  document.getElementById('issueModalSave').textContent = editingIssue ? 'حفظ التعديلات' : 'حفظ الملاحظة';
  document.getElementById('fProject').value = editingIssue ? editingIssue.project : '';
  document.getElementById('fCategory').value = editingIssue ? editingIssue.category : 'إنشائي';
  document.getElementById('fSeverity').value = editingIssue ? editingIssue.severity : 'متوسطة';
  document.getElementById('fStatus').value = editingIssue ? (editingIssue.status || 'مفتوحة') : 'مفتوحة';
  document.getElementById('fAssignee').value = editingIssue ? (editingIssue.assignee || '') : '';
  document.getElementById('fDueDate').value = editingIssue ? (editingIssue.dueDate || '') : '';
  document.getElementById('fDescription').value = editingIssue ? editingIssue.description : '';
  document.getElementById('fCause').value = editingIssue ? (editingIssue.cause || '') : '';
  document.getElementById('fAction').value = editingIssue ? (editingIssue.action || '') : '';
  populateProjectDatalist();
  document.getElementById('issueModalOverlay').classList.add('show');
  document.getElementById('fProject').focus();
}
function closeIssueModal(){ document.getElementById('issueModalOverlay').classList.remove('show'); editingIssue = null; }

async function saveManualIssue(){
  const project = document.getElementById('fProject').value.trim();
  const description = document.getElementById('fDescription').value.trim();
  if (!project || !description){ showToast('الرجاء تعبئة المشروع والملاحظة على الأقل'); return; }
  const data = {
    project,
    category: document.getElementById('fCategory').value,
    severity: document.getElementById('fSeverity').value,
    status: document.getElementById('fStatus').value,
    assignee: document.getElementById('fAssignee').value.trim(),
    dueDate: document.getElementById('fDueDate').value,
    description,
    cause: document.getElementById('fCause').value.trim(),
    action: document.getElementById('fAction').value.trim()
  };
  const wasEditing = !!editingIssue;
  if (editingIssue) Object.assign(editingIssue, data);
  else issues.push(data);
  closeIssueModal();
  renderAll();
  if (!currentDocId && db) await saveCurrentAnalysisToDb(); else persistIssuesToDb();
  showToast(wasEditing ? 'تم حفظ التعديلات' : 'تمت إضافة الملاحظة وحفظها');
}

document.getElementById('addIssueBtn').addEventListener('click', () => openIssueModal());
document.getElementById('issueModalClose').addEventListener('click', closeIssueModal);
document.getElementById('issueModalCancel').addEventListener('click', closeIssueModal);
document.getElementById('issueModalSave').addEventListener('click', saveManualIssue);
document.getElementById('issueModalOverlay').addEventListener('click', e => { if (e.target.id === 'issueModalOverlay') closeIssueModal(); });
populateCategorySelect();

/* ===================== Share / QR modal ===================== */
function getShareUrl(id){
  const base = window.location.origin + window.location.pathname;
  return base + '?open=' + encodeURIComponent(id);
}
function openShareModal(id){
  if (!id){ showToast('يرجى الانتظار حتى يتم حفظ هذا التحليل أولًا'); return; }
  const url = getShareUrl(id);
  document.getElementById('shareLinkInput').value = url;
  const holder = document.getElementById('qrHolder');
  holder.innerHTML = '';
  const canvas = document.createElement('canvas');
  holder.appendChild(canvas);
  try {
    if (window.QRCode && QRCode.toCanvas){
      QRCode.toCanvas(canvas, url, { width: 180, margin: 1, color: { dark: '#201F1D', light: '#FFFFFF' } }, function(err){
        if (err) holder.innerHTML = '<div class="empty-note">تعذّر إنشاء رمز QR</div>';
      });
    } else {
      holder.innerHTML = '<div class="empty-note">مكتبة QR غير متاحة حاليًا</div>';
    }
  } catch(e){ holder.innerHTML = '<div class="empty-note">تعذّر إنشاء رمز QR</div>'; }
  document.getElementById('shareModalOverlay').classList.add('show');
}
function closeShareModal(){ document.getElementById('shareModalOverlay').classList.remove('show'); }
document.getElementById('shareModalClose').addEventListener('click', closeShareModal);
document.getElementById('shareModalOverlay').addEventListener('click', e => { if (e.target.id === 'shareModalOverlay') closeShareModal(); });
document.getElementById('copyShareLinkBtn').addEventListener('click', async () => {
  const val = document.getElementById('shareLinkInput').value;
  try { await navigator.clipboard.writeText(val); showToast('تم نسخ الرابط'); }
  catch(e){
    const input = document.getElementById('shareLinkInput');
    input.removeAttribute('readonly'); input.select(); document.execCommand('copy'); input.setAttribute('readonly','readonly');
    showToast('تم نسخ الرابط');
  }
});
document.getElementById('shareBtn').addEventListener('click', () => openShareModal(currentDocId));

renderAll();
initDb();
