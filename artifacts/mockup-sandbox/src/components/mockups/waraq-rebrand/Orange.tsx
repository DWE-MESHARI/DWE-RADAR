import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowDownToLine, BookOpen, Check, ChevronDown, Clock3, FileText, HardDrive,
  ImagePlus, Plus, Presentation, Quote, Search, ShieldCheck, SlidersHorizontal,
  StickyNote, Trash2, Upload, X, Pencil, FileJson, FileWarning, LoaderCircle,
} from 'lucide-react';
import './_group.css';
import './Orange.css';

type Finding = {
  id: string;
  slideNumber: number;
  section: string;
  kind: string;
  severity: string;
  text: string;
  evidence: string;
};
type SlideRecord = { number: number; title: string; text: string };
type UserNote = {
  id: string;
  text: string;
  slideNumber?: number;
  quote?: string;
  imageDataUrl?: string;
  createdAt: string;
};
type PresentationAnalysis = {
  id: string;
  fileName: string;
  createdAt: string;
  slideCount: number;
  slides: SlideRecord[];
  findings: Finding[];
  notes: UserNote[];
};

const STORAGE_KEY = 'waraq-review-sandbox';

async function getAnalyses(): Promise<PresentationAnalysis[]> {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) as PresentationAnalysis[] : [];
}

async function saveAnalysis(analysis: PresentationAnalysis): Promise<void> {
  const analyses = await getAnalyses();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([
    analysis,
    ...analyses.filter(item => item.id !== analysis.id),
  ]));
}

async function removeAnalysis(id: string): Promise<void> {
  const analyses = await getAnalyses();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(analyses.filter(item => item.id !== id)));
}

async function parsePresentation(_file: File): Promise<PresentationAnalysis> {
  throw new Error('قراءة ملفات PowerPoint غير مفعّلة في المعاينة المستقلة.');
}

type NoteDraft = { id?: string; text: string; slideNumber?: number; quote?: string; imageDataUrl?: string };

const severityTone: Record<string, string> = {
  'مرتفع': 'severity-high',
  'متوسط': 'severity-mid',
  'منخفض': 'severity-low',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name.replace(/[\\/:*?"<>|]+/g, '-');
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
}

function Orange() {
  const [analyses, setAnalyses] = useState<PresentationAnalysis[]>([]);
  const [activeId, setActiveId] = useState('');
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [progress, setProgress] = useState<{ name: string; index: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [severity, setSeverity] = useState('الكل');
  const [sectionFilter, setSectionFilter] = useState('الكل');
  const [slideFilter, setSlideFilter] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'findings' | 'slides'>('findings');
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [selectedSlide, setSelectedSlide] = useState<SlideRecord | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserNote | null>(null);
  const [deleteAnalysisTarget, setDeleteAnalysisTarget] = useState<PresentationAnalysis | null>(null);
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const active = analyses.find(item => item.id === activeId) || null;

  useEffect(() => {
    getAnalyses().then(items => {
      setAnalyses(items);
      if (items[0]) setActiveId(items[0].id);
    }).catch(() => setError('تعذّر فتح مساحة التخزين المحلية في هذا المتصفح.')).finally(() => setLoadingSaved(false));
  }, []);

  const updateActive = async (next: PresentationAnalysis) => {
    setAnalyses(current => current.map(item => item.id === next.id ? next : item));
    try { await saveAnalysis(next); }
    catch { setNotice('تعذّر حفظ التغيير محليًا. تحقق من مساحة التخزين المتاحة.'); }
  };

  const activateAnalysis = (id: string) => {
    setActiveId(id);
    setActiveTab('findings');
    setSeverity('الكل');
    setSectionFilter('الكل');
    setSlideFilter('');
    setSearch('');
  };

  const addFiles = async (files: FileList | File[]) => {
    const selected = Array.from(files);
    const valid = selected.filter(file => file.name.toLowerCase().endsWith('.pptx'));
    if (!valid.length) { setError('اختر ملف PowerPoint بامتداد .pptx.'); return; }
    setError(selected.length > valid.length ? 'تم تجاهل الملفات التي لا تنتهي بامتداد .pptx.' : '');
    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      setProgress({ name: file.name, index: i + 1, total: valid.length });
      try {
        const result = await parsePresentation(file);
        await saveAnalysis(result);
        setAnalyses(current => [result, ...current]);
        activateAnalysis(result.id);
      } catch (reason) {
        setError(reason instanceof Error ? `${file.name}: ${reason.message}` : `تعذّر قراءة الملف ${file.name}.`);
      }
    }
    setProgress(null);
  };

  const findings = active?.findings || [];
  const sections = useMemo(() => [...new Set(findings.map(item => item.section))].sort((a, b) => a.localeCompare(b, 'ar')), [findings]);
  const topSections = useMemo(() => {
    const counts = findings.reduce((all, item) => {
      all[item.section] = (all[item.section] || 0) + 1;
      return all;
    }, {} as Record<string, number>);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [findings]);
  const filteredFindings = useMemo(() => findings.filter(item => {
    const matchesSeverity = severity === 'الكل' || item.severity === severity;
    const matchesSection = sectionFilter === 'الكل' || item.section === sectionFilter;
    const matchesSlide = !slideFilter || item.slideNumber === Number(slideFilter);
    const query = search.trim().toLocaleLowerCase('ar');
    const matchesSearch = !query || `${item.text} ${item.evidence} ${item.section} ${item.kind}`.toLocaleLowerCase('ar').includes(query);
    return matchesSeverity && matchesSection && matchesSlide && matchesSearch;
  }), [findings, severity, sectionFilter, slideFilter, search]);

  const severityCounts = useMemo(() => findings.reduce((all, item) => {
    all[item.severity] = (all[item.severity] || 0) + 1;
    return all;
  }, {} as Record<string, number>), [findings]);

  const exportJson = () => {
    if (!active) return;
    downloadFile(`${active.fileName.replace(/\.pptx$/i, '')}-تحليل.json`, JSON.stringify(active, null, 2), 'application/json;charset=utf-8');
    setNotice('تم تجهيز ملف JSON للتنزيل.');
  };
  const exportHtml = () => {
    if (!active) return;
    const summary = active.findings.reduce((all, item) => {
      all[item.severity] = (all[item.severity] || 0) + 1;
      return all;
    }, {} as Record<string, number>);
    const sections = active.findings.reduce((all, item) => {
      all[item.section] = (all[item.section] || 0) + 1;
      return all;
    }, {} as Record<string, number>);
    const sectionsHtml = Object.entries(sections).sort((a, b) => b[1] - a[1]).map(([name, count]) => `<li>${escapeHtml(name)}: ${count}</li>`).join('');
    const findingsHtml = active.findings.map(item => `<article><small>الشريحة ${item.slideNumber} · ${escapeHtml(item.kind)} · ${escapeHtml(item.severity)}</small><h3>${escapeHtml(item.text)}</h3><blockquote>${escapeHtml(item.evidence)}</blockquote></article>`).join('');
    const notesHtml = active.notes.map(note => `<article><small>${note.slideNumber ? `الشريحة ${note.slideNumber} · ` : ''}${escapeHtml(formatDate(note.createdAt))}</small><p>${escapeHtml(note.text)}</p>${note.quote ? `<blockquote>${escapeHtml(note.quote)}</blockquote>` : ''}${note.imageDataUrl ? `<img src="${note.imageDataUrl}" alt="صورة مرفقة">` : ''}</article>`).join('');
    const slidesHtml = active.slides.map(slide => `<article><small>الشريحة ${slide.number}</small><h3>${escapeHtml(slide.title)}</h3><p>${escapeHtml(slide.text).replace(/\n/g, '<br>')}</p></article>`).join('');
    const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>تقرير ${escapeHtml(active.fileName)}</title><style>body{font:17px/1.8 system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 22px;background:#f5f2e9;color:#213c36}header{padding:28px 0;border-bottom:1px solid #ccc}article{background:#fffdf7;padding:20px;margin:14px 0;border:1px solid #e5dfd2;border-radius:12px}small{color:#68776e}blockquote{border-right:3px solid #c98559;padding:8px 14px;background:#f7f3e9;margin:12px 0}h1{font-size:28px}img{max-width:100%;height:auto}</style><header><h1>سجلّ المراجعة</h1><p>${escapeHtml(active.fileName)} · ${active.slideCount} شريحة · ${escapeHtml(formatDate(active.createdAt))}</p><p>تقرير محلي من النص المستخرج والملاحظات المحفوظة في هذا المتصفح. المؤشرات قواعد نصية أولية وتحتاج إلى مراجعتك.</p></header><h2>ملخص الأولويات</h2><p>مرتفع: ${summary['مرتفع'] || 0} · متوسط: ${summary['متوسط'] || 0} · منخفض: ${summary['منخفض'] || 0}</p><h2>توزيع المجالات</h2><ul>${sectionsHtml || '<li>لا توجد مؤشرات مصنفة.</li>'}</ul><h2>ملاحظات المراجعة (${active.notes.length})</h2>${notesHtml || '<p>لا توجد ملاحظات مضافة.</p>'}<h2>المؤشرات المرصودة (${active.findings.length})</h2>${findingsHtml || '<p>لم تظهر مؤشرات نصية محلية في الملف.</p>'}<h2>نص الشرائح</h2>${slidesHtml}</html>`;
    downloadFile(`${active.fileName.replace(/\.pptx$/i, '')}-تقرير.html`, html, 'text/html;charset=utf-8');
    setNotice('تم تنزيل التقرير المستقل؛ يتضمن النصوص والملاحظات والصور المرفقة.');
  };

  const saveNote = async () => {
    if (!active || !noteDraft?.text.trim()) return;
    const now = new Date().toISOString();
    const note: UserNote = {
      id: noteDraft.id || crypto.randomUUID(), text: noteDraft.text.trim(),
      slideNumber: noteDraft.slideNumber, quote: noteDraft.quote?.trim() || undefined,
      imageDataUrl: noteDraft.imageDataUrl, createdAt: noteDraft.id ? active.notes.find(n => n.id === noteDraft.id)?.createdAt || now : now,
    };
    const notes = noteDraft.id ? active.notes.map(item => item.id === note.id ? note : item) : [note, ...active.notes];
    await updateActive({ ...active, notes });
    setNoteDraft(null);
    setNotice(noteDraft.id ? 'تم تحديث الملاحظة.' : 'تم حفظ الملاحظة في هذا المتصفح.');
  };
  const removeNote = async () => {
    if (!active || !deleteTarget) return;
    await updateActive({ ...active, notes: active.notes.filter(item => item.id !== deleteTarget.id) });
    setDeleteTarget(null);
    setNotice('تم حذف الملاحظة.');
  };
  const removeStudy = (id: string) => {
    const target = analyses.find(item => item.id === id);
    if (target) setDeleteAnalysisTarget(target);
  };
  const confirmRemoveStudy = async () => {
    if (!deleteAnalysisTarget) return;
    const id = deleteAnalysisTarget.id;
    try {
      await removeAnalysis(id);
      const remaining = analyses.filter(item => item.id !== id);
      setAnalyses(remaining);
      if (activeId === id) {
        if (remaining[0]) activateAnalysis(remaining[0].id);
        else setActiveId('');
      }
      setDeleteAnalysisTarget(null);
      setNotice('تم حذف التحليل وملاحظاته وصوره من هذا المتصفح.');
    } catch { setNotice('تعذّر حذف هذا التحليل من التخزين المحلي.'); }
  };

  const openSlide = (number: number) => {
    const slide = active?.slides.find(item => item.number === number);
    if (slide) { setSelectedSlide(slide); setSelectedFinding(null); }
  };
  const beginNote = (slideNumber?: number, quote?: string, note?: UserNote) => {
    setSelectedFinding(null);
    setSelectedSlide(null);
    setNoteDraft(note
      ? { id: note.id, text: note.text, slideNumber: note.slideNumber, quote: note.quote, imageDataUrl: note.imageDataUrl }
      : { text: '', slideNumber, quote });
  };

  return (
    <div className="workspace-shell orange-variant" dir="rtl">
      <header className="topbar">
        <div className="topbar-inner max-w-[1440px] mx-auto px-8 h-[76px] flex items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="brand-mark"><Presentation size={21} strokeWidth={1.8} /></div>
            <div>
              <div className="brand-name">وَرَق</div>
              <div className="brand-caption">مساحة مراجعة العروض</div>
            </div>
          </div>
          <div className="privacy-chip desktop-only"><ShieldCheck size={15} /><span>ملفاتك وملاحظاتك تبقى في هذا المتصفح</span></div>
          <div className="flex items-center gap-2">
            {active && <>
              <button className="top-action desktop-only" onClick={exportJson} data-testid="button-export-json"><FileJson size={16} /> JSON</button>
              <button className="top-action report-action" onClick={exportHtml} data-testid="button-export-html"><ArrowDownToLine size={16} /><span className="desktop-only">تصدير التقرير</span><span className="mobile-only-label">تقرير</span></button>
            </>}
            <button className="add-file-button" onClick={() => fileInput.current?.click()} data-testid="button-upload-top"><Plus size={17} /><span>عرض جديد</span></button>
          </div>
        </div>
      </header>

      <input ref={fileInput} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" multiple hidden data-testid="input-pptx" onChange={event => { if (event.target.files) void addFiles(event.target.files); event.target.value = ''; }} />
      <main className="max-w-[1440px] mx-auto px-8 py-8 mobile-wrap">
        <div className="page-intro animate-in">
          <div>
            <div className="eyebrow"><span className="eyebrow-rule" />مكتب مراجعة خاص</div>
            <h1>{active ? 'نظرة أوضح، شريحةً شريحة' : 'كل عرض يستحق مراجعة هادئة'}</h1>
            <p>{active ? 'مؤشرات مرتبطة بنص الشرائح، ومساحة تحفظ ملاحظاتك بجانب مصدرها.' : 'ارفع ملفك، استعرض النص المستخرج، وسجّل ما يستحق المتابعة — محليًا.'}</p>
          </div>
          {active && <div className="active-file-pill"><Presentation size={16} /><span className="truncate max-w-[220px]">{active.fileName}</span><button title="حذف التحليل" aria-label="حذف التحليل" onClick={() => removeStudy(active.id)} data-testid="button-delete-analysis"><Trash2 size={15} /></button></div>}
        </div>

        {error && <div className="error-banner" role="alert"><AlertCircle size={18} /><span>{error}</span><button onClick={() => setError('')} aria-label="إغلاق رسالة الخطأ"><X size={16} /></button></div>}
        {notice && <div className="notice-banner" role="status"><Check size={16} />{notice}<button aria-label="إغلاق التنبيه" onClick={() => setNotice('')}><X size={15} /></button></div>}

        {!active && (
          <section className="empty-layout animate-in delay-1">
            <div className={`upload-zone empty-upload ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }} onClick={() => fileInput.current?.click()} role="button" tabIndex={0} onKeyDown={event => event.key === 'Enter' && fileInput.current?.click()} data-testid="dropzone-pptx">
              <div className="upload-illustration"><Upload size={25} /></div>
              <h2>ابدأ بعرضك الأول</h2>
              <p>اسحب ملف PowerPoint إلى هنا، أو اختره من جهازك.<br />يمكنك إضافة أكثر من ملف دفعة واحدة.</p>
              <button className="primary-button" onClick={event => { event.stopPropagation(); fileInput.current?.click(); }} data-testid="button-choose-file"><Plus size={17} />اختيار ملفات العرض</button>
              <span className="file-hint">ملفات .pptx فقط · يُعالج المحتوى على جهازك</span>
              {progress && <div className="progress-line"><LoaderCircle size={16} className="spin" />جارٍ قراءة {progress.name} · {progress.index} من {progress.total}</div>}
            </div>
            <div className="empty-aside">
              <div className="empty-note"><div className="empty-note-symbol"><BookOpen size={18} /></div><div><h3>من النص إلى الملاحظة</h3><p>تصفّح النص المستخرج من الشرائح، وافتح كل اقتباس في موضعه قبل تدوين ملاحظتك.</p></div></div>
              <div className="empty-note"><div className="empty-note-symbol warm"><HardDrive size={18} /></div><div><h3>خصوصية من البداية</h3><p>لا رفع إلى خادم ولا حساب سحابي. تبقى التحليلات والمرفقات في تخزين المتصفح.</p></div></div>
              <div className="method-card"><span className="method-index">مبدأ المراجعة</span><p>المؤشرات قواعد نصية محلية قابلة للتحقق، وليست حكمًا على جودة العرض.</p></div>
            </div>
          </section>
        )}

        {active && (
          <>
            <section className="stats-grid animate-in delay-1">
              <div className="stat-card"><span>عدد الشرائح</span><strong>{active.slideCount}</strong><small>نصوص مستخرجة محليًا</small><div className="stat-icon"><Presentation size={18} /></div></div>
              <div className="stat-card"><span>مؤشرات للمراجعة</span><strong>{findings.length}</strong><small>قواعد نصية قابلة للتحقق</small><div className="stat-icon amber"><FileWarning size={18} /></div></div>
              <div className="stat-card"><span>ملاحظاتك</span><strong>{active.notes.length}</strong><small>مرتبطة بالعرض الحالي</small><div className="stat-icon blue"><StickyNote size={18} /></div></div>
              <div className="stat-card saved-stat"><span>الحفظ المحلي</span><strong className="saved-value"><span className="saved-dot" />محفوظ</strong><small>أضيف في {formatDate(active.createdAt)}</small><div className="stat-icon green"><ShieldCheck size={18} /></div></div>
            </section>

            <section className="charts-row animate-in delay-2">
              <div className="panel chart-panel">
                <div className="panel-heading"><div><span className="section-kicker">توزيع المؤشرات</span><h2>ما الذي يستحق نظرة ثانية؟</h2></div><SlidersHorizontal size={18} className="heading-glyph" /></div>
                <div className="severity-chart">
                  {(['مرتفع', 'متوسط', 'منخفض'] as const).map((name, index) => {
                    const count = severityCounts[name] || 0;
                    const percent = findings.length ? Math.max(count ? 8 : 0, count / findings.length * 100) : 0;
                    return <button className={`chart-line ${severity === name ? 'chart-selected' : ''}`} key={name} onClick={() => setSeverity(severity === name ? 'الكل' : name)} data-testid={`filter-chart-${index}`}>
                      <span className="chart-label"><i className={`dot ${severityTone[name]}`} />{name}</span>
                      <span className="bar-track"><span className={`bar-fill bar-${index}`} style={{ width: `${percent}%` }} /></span>
                      <strong>{count}</strong>
                    </button>;
                  })}
                </div>
                <div className="chart-footnote">تظهر الأعداد من نصوص الشرائح فقط، وتحتاج إلى مراجعتك.</div>
              </div>
              <div className="panel chart-panel category-panel">
                <div className="panel-heading"><div><span className="section-kicker">توزيع الأقسام</span><h2>مجالات الملاحظة</h2></div><SlidersHorizontal size={18} className="heading-glyph" /></div>
                <div className="severity-chart category-chart">
                  {topSections.length ? topSections.map(([name, count], index) => {
                    const maxCount = topSections[0]?.[1] || 1;
                    const selected = sectionFilter === name;
                    return <button className={`chart-line category-chart-line ${selected ? 'chart-selected' : ''}`} key={name} onClick={() => { setSectionFilter(selected ? 'الكل' : name); setActiveTab('findings'); }}>
                      <span className="chart-label"><i className={`dot category-dot category-dot-${index}`} />{name}</span>
                      <span className="bar-track"><span className={`bar-fill category-bar-${index}`} style={{ width: `${Math.max(count ? 8 : 0, count / maxCount * 100)}%` }} /></span>
                      <strong>{count}</strong>
                    </button>;
                  }) : <p className="category-empty">لا توجد مؤشرات موزعة على أقسام بعد.</p>}
                </div>
                <div className="chart-footnote">اختر مجالًا لعرض مؤشراته في السجل.</div>
              </div>
              <div className="panel source-panel">
                <div className="panel-heading"><div><span className="section-kicker">الملف المفتوح</span><h2>بطاقة العرض</h2></div><FileText size={18} className="heading-glyph" /></div>
                <div className="source-title">{active.fileName}</div>
                <div className="source-meta"><span><Clock3 size={14} />أضيف في {formatDate(active.createdAt)}</span><span>{active.slides.length} شريحة</span></div>
                <div className="source-divider" />
                <div className="rule-caption"><ShieldCheck size={15} /><span>طريقة الرصد</span></div>
                <p className="rule-copy">يرصد النصوص المتعلقة بالإنشاءات والسلامة والكهرباء والسباكة والتشطيبات والتواصل، ويفصل الملاحظة والسبب والإجراء المقترح عند وجودها.</p>
              </div>
            </section>

            <section className="main-grid animate-in delay-3">
              <div className="panel findings-panel">
                <div className="content-header">
                  <div><span className="section-kicker">سجلّ المراجعة</span><h2>محتوى العرض</h2></div>
                  <div className="count-badge">{activeTab === 'findings' ? `${filteredFindings.length} مؤشر` : `${active.slides.length} شريحة`}</div>
                </div>
                <div className="tabs-row" role="tablist">
                  <button className={activeTab === 'findings' ? 'tab-active' : ''} onClick={() => setActiveTab('findings')} role="tab" data-testid="tab-findings">المؤشرات <span>{findings.length}</span></button>
                  <button className={activeTab === 'slides' ? 'tab-active' : ''} onClick={() => setActiveTab('slides')} role="tab" data-testid="tab-slides">نص الشرائح <span>{active.slides.length}</span></button>
                </div>
                {activeTab === 'findings' ? <>
                  <div className="filters">
                    <label className="search-field"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث في المؤشرات..." aria-label="ابحث في المؤشرات" data-testid="input-search-findings" /></label>
                    <label className="filter-select"><span>الأهمية</span><select value={severity} onChange={event => setSeverity(event.target.value)} aria-label="تصفية حسب الأهمية" data-testid="select-severity"><option>الكل</option><option>مرتفع</option><option>متوسط</option><option>منخفض</option></select><ChevronDown size={13} /></label>
                    <label className="filter-select"><span>القسم</span><select value={sectionFilter} onChange={event => setSectionFilter(event.target.value)} aria-label="تصفية حسب القسم" data-testid="select-section"><option>الكل</option>{sections.map(section => <option key={section}>{section}</option>)}</select><ChevronDown size={13} /></label>
                    <label className="slide-filter"><span>الشريحة</span><input type="number" min="1" max={active.slideCount} placeholder="الكل" value={slideFilter} onChange={event => setSlideFilter(event.target.value)} aria-label="تصفية برقم الشريحة" data-testid="input-filter-slide" /></label>
                  </div>
                  {filteredFindings.length ? <div className="finding-list">
                    {filteredFindings.map(finding => <article className="finding-row" key={finding.id} data-testid={`finding-${finding.id}`}>
                      <button className="finding-main" onClick={() => setSelectedFinding(finding)} data-testid={`button-open-finding-${finding.id}`}>
                        <div className="finding-meta"><span className={`severity-tag ${severityTone[finding.severity]}`}>{finding.severity}</span><span className="finding-kind">{finding.kind}</span><span className="finding-category">{finding.section}</span><span className="slide-tag">شريحة {finding.slideNumber}</span></div>
                        <h3>{finding.text}</h3>
                        <p className="evidence-preview"><Quote size={13} />{finding.evidence}</p>
                      </button>
                      <button className="open-quote" onClick={() => setSelectedFinding(finding)} aria-label={`فتح الاقتباس من الشريحة ${finding.slideNumber}`} data-testid={`button-quote-${finding.id}`}><ArrowDownToLine size={16} /></button>
                    </article>)}
                  </div> : <div className="empty-results"><div className="empty-results-icon"><Search size={20} /></div><h3>{findings.length ? 'لا نتائج بهذه التصفية' : 'لا توجد مؤشرات نصية'}</h3><p>{findings.length ? 'جرّب تغيير الأهمية أو القسم أو رقم الشريحة أو عبارة البحث.' : 'لم ترصد القواعد المحلية كلمات أو أنماطًا تستحق الإشارة. يمكنك مراجعة نص الشرائح وإضافة ملاحظاتك.'}</p>{findings.length > 0 && <button className="text-button" onClick={() => { setSeverity('الكل'); setSectionFilter('الكل'); setSlideFilter(''); setSearch(''); }}>إزالة التصفية</button>}</div>}
                </> : <div className="slide-list">
                  {active.slides.map(slide => <button className="slide-row" key={slide.number} onClick={() => openSlide(slide.number)} data-testid={`button-open-slide-${slide.number}`}>
                    <span className="slide-number">{String(slide.number).padStart(2, '0')}</span><span className="slide-content"><strong>{slide.title}</strong><small>{slide.text.slice(0, 150) || 'لم يُستخرج نص من هذه الشريحة'}{slide.text.length > 150 ? '…' : ''}</small></span><span className="slide-open-label">فتح النص <ChevronDown size={14} /></span>
                  </button>)}
                </div>}
                <div className="panel-footer"><span><ShieldCheck size={14} /> النصوص محفوظة على هذا الجهاز فقط</span><button onClick={exportJson} data-testid="button-footer-export">تصدير البيانات <ArrowDownToLine size={14} /></button></div>
              </div>

              <aside className="right-rail">
                <div className="panel notes-panel">
                  <div className="notes-heading"><div><span className="section-kicker">مساحة خاصة</span><h2>ملاحظات المراجع</h2></div><div className="notes-count">{active.notes.length}</div></div>
                  <p className="notes-intro">أضف قرارًا أو سؤالًا أو سياقًا بجانب العرض.</p>
                  <button className="new-note-button" onClick={() => beginNote()} data-testid="button-add-note"><Plus size={16} />ملاحظة جديدة</button>
                  {active.notes.length ? <div className="notes-list">{active.notes.map(note => <article className="note-card" key={note.id} data-testid={`note-${note.id}`}>
                    <div className="note-card-top"><span>{note.slideNumber ? `شريحة ${note.slideNumber}` : 'ملاحظة عامة'}</span><div><button onClick={() => beginNote(undefined, undefined, note)} aria-label="تحرير الملاحظة" data-testid={`button-edit-note-${note.id}`}><Pencil size={14} /></button><button onClick={() => setDeleteTarget(note)} aria-label="حذف الملاحظة" data-testid={`button-delete-note-${note.id}`}><Trash2 size={14} /></button></div></div>
                    <p>{note.text}</p>{note.quote && <blockquote>{note.quote}</blockquote>}{note.imageDataUrl && <img src={note.imageDataUrl} alt="مرفق الملاحظة" className="note-image" />}
                    <time>{formatDate(note.createdAt)}</time>
                  </article>)}</div> : <div className="notes-empty"><div className="note-empty-mark"><StickyNote size={18} /></div><p>مساحة ملاحظاتك جاهزة.<br />اربطها بشريحة أو اتركها عامة.</p></div>}
                </div>
                <div className="local-storage-card"><span className="storage-icon"><HardDrive size={16} /></span><div><strong>محفوظ محليًا</strong><p>يمكنك العودة إلى عملك من هذا المتصفح.</p></div><span className="storage-dot" /></div>
                {analyses.length > 1 && <div className="panel recent-panel"><div className="recent-heading"><span className="section-kicker">أعمال محفوظة</span><span>{analyses.length}</span></div>{analyses.filter(item => item.id !== active.id).map(item => <div className="recent-item" key={item.id}><button onClick={() => activateAnalysis(item.id)} data-testid={`button-restore-${item.id}`}><FileText size={15} /><span>{item.fileName}</span></button><button aria-label="حذف التحليل" onClick={() => removeStudy(item.id)}><Trash2 size={14} /></button></div>)}</div>}
              </aside>
            </section>
          </>
        )}
        {loadingSaved && <div className="loading-state"><span className="skeleton-block" /><span className="skeleton-block short" />جارٍ استعادة عملك المحفوظ…</div>}
        {progress && active && <div className="processing-toast"><LoaderCircle size={17} className="spin" />جارٍ تحليل {progress.name} <span>{progress.index} / {progress.total}</span></div>}
        <footer className="page-footer"><span>وَرَق <i>·</i> مساحة محلية لمراجعة العروض</span><span>التحليل قائم على النص المستخرج من الملف، وقد لا يشمل النص داخل الصور.</span></footer>
      </main>

      {(selectedFinding || selectedSlide) && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) { setSelectedFinding(null); setSelectedSlide(null); } }}>
        <section className="quote-modal" role="dialog" aria-modal="true" aria-labelledby="quote-title">
          <div className="modal-top"><div><span className="section-kicker">مرجع من الملف الأصلي</span><h2 id="quote-title">نص الشريحة</h2></div><button className="icon-button" onClick={() => { setSelectedFinding(null); setSelectedSlide(null); }} aria-label="إغلاق"><X size={19} /></button></div>
          <div className="quote-source"><span className="slide-number">{String((selectedFinding?.slideNumber || selectedSlide?.number) || 0).padStart(2, '0')}</span><div><strong>{active?.slides.find(s => s.number === (selectedFinding?.slideNumber || selectedSlide?.number))?.title}</strong><small>{active?.fileName}</small></div></div>
          {selectedFinding && <div className="finding-detail"><span className={`severity-tag ${severityTone[selectedFinding.severity]}`}>{selectedFinding.severity}</span><p>{selectedFinding.text}</p></div>}
          <blockquote className="quote-full">{selectedFinding?.evidence || selectedSlide?.text || 'لا يوجد نص مستخرج من هذه الشريحة.'}</blockquote>
          <div className="full-slide-text">{selectedSlide && selectedSlide.text !== selectedSlide.title && selectedSlide.text.split('\n').slice(1).join('\n')}</div>
          <div className="modal-actions"><button className="secondary-button" onClick={() => beginNote(selectedFinding?.slideNumber || selectedSlide?.number, selectedFinding?.evidence || selectedSlide?.text)} data-testid="button-note-from-quote"><Plus size={16} />أضف ملاحظة مرتبطة</button><button className="text-button" onClick={() => { setSelectedFinding(null); setSelectedSlide(null); }}>إغلاق</button></div>
        </section>
      </div>}

      {noteDraft && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setNoteDraft(null); }}>
        <section className="note-modal" role="dialog" aria-modal="true" aria-labelledby="note-title">
          <div className="modal-top"><div><span className="section-kicker">{noteDraft.id ? 'تحديث سجلّك' : 'سجلّ خاص'}</span><h2 id="note-title">{noteDraft.id ? 'تحرير الملاحظة' : 'ملاحظة جديدة'}</h2></div><button className="icon-button" onClick={() => setNoteDraft(null)} aria-label="إغلاق"><X size={19} /></button></div>
          {noteDraft.slideNumber && <div className="context-strip"><BookOpen size={15} />مرتبطة بالشريحة {noteDraft.slideNumber}</div>}
          <label className="field-label" htmlFor="note-text">ملاحظتك</label>
          <textarea id="note-text" autoFocus value={noteDraft.text} onChange={event => setNoteDraft({ ...noteDraft, text: event.target.value })} placeholder="دوّن ما تريد تذكّره أو متابعته…" data-testid="textarea-note" />
          <label className="field-label" htmlFor="note-quote">اقتباس مرجعي <span>اختياري</span></label>
          <textarea id="note-quote" className="quote-input" value={noteDraft.quote || ''} onChange={event => setNoteDraft({ ...noteDraft, quote: event.target.value })} placeholder="أضف نصًا من الشريحة لتسهيل الرجوع إليه…" data-testid="textarea-note-quote" />
          {noteDraft.imageDataUrl && <div className="image-preview"><img src={noteDraft.imageDataUrl} alt="معاينة المرفق" /><button onClick={() => setNoteDraft({ ...noteDraft, imageDataUrl: undefined })} aria-label="إزالة الصورة"><X size={15} /></button></div>}
          <input ref={imageInput} type="file" accept="image/*" hidden onChange={event => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { setNotice('اختر ملف صورة صالحًا.'); event.target.value = ''; return; }
            if (file.size > 10 * 1024 * 1024) { setNotice('حجم الصورة أكبر من 10 ميغابايت.'); event.target.value = ''; return; }
            const reader = new FileReader();
            reader.onload = () => setNoteDraft(current => current ? { ...current, imageDataUrl: String(reader.result) } : current);
            reader.readAsDataURL(file);
            event.target.value = '';
          }} data-testid="input-note-image" />
          <div className="note-modal-bottom"><button className="attach-button" onClick={() => imageInput.current?.click()} data-testid="button-attach-image"><ImagePlus size={16} />إرفاق صورة</button><span>المرفق يبقى محليًا</span></div>
          <div className="modal-actions"><button className="primary-button" disabled={!noteDraft.text.trim()} onClick={saveNote} data-testid="button-save-note"><Check size={16} />{noteDraft.id ? 'حفظ التعديلات' : 'حفظ الملاحظة'}</button><button className="text-button" onClick={() => setNoteDraft(null)}>إلغاء</button></div>
        </section>
      </div>}

      {deleteTarget && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setDeleteTarget(null); }}>
        <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="confirm-icon"><Trash2 size={19} /></div><h2 id="delete-title">حذف هذه الملاحظة؟</h2><p>لن يمكن استعادة هذا التغيير بعد الحذف.</p><div className="modal-actions"><button className="danger-button" onClick={removeNote} data-testid="button-confirm-delete-note">حذف الملاحظة</button><button className="text-button" onClick={() => setDeleteTarget(null)}>إبقاء</button></div></section>
      </div>}
      {deleteAnalysisTarget && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setDeleteAnalysisTarget(null); }}>
        <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-analysis-title"><div className="confirm-icon"><Trash2 size={19} /></div><h2 id="delete-analysis-title">حذف هذا التحليل؟</h2><p>سيُحذف النص المستخرج وملاحظاتك وصورك المرتبطة به من هذا المتصفح.</p><div className="modal-actions"><button className="danger-button" onClick={confirmRemoveStudy} data-testid="button-confirm-delete-analysis">حذف التحليل</button><button className="text-button" onClick={() => setDeleteAnalysisTarget(null)}>إبقاء</button></div></section>
      </div>}
    </div>
  );
}

export default Orange;
