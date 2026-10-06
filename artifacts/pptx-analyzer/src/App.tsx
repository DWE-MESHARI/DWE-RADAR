import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, Presentation, Trash2, X } from 'lucide-react';
import type { Finding, PresentationAnalysis, SlideRecord, UserNote } from './lib/pptx';
import { parsePresentation } from './lib/pptx';
import { getAnalyses, removeAnalysis, saveAnalysis } from './lib/storage';
import { downloadAnalysisJson, downloadAnalysisReport } from './lib/exports';
import { type NoteDraft } from './lib/view';
import { AnalysisOverview } from './components/AnalysisOverview';
import { AppHeader } from './components/AppHeader';
import { EmptyState } from './components/EmptyState';
import { ReviewModals } from './components/ReviewModals';
import { ReviewWorkspace } from './components/ReviewWorkspace';

function App() {
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
    downloadAnalysisJson(active);
    setNotice('تم تجهيز ملف JSON للتنزيل.');
  };
  const exportHtml = () => {
    if (!active) return;
    downloadAnalysisReport(active);
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
    <div className="workspace-shell brand-orange" dir="rtl">
      <AppHeader
        hasActiveAnalysis={Boolean(active)}
        onExportJson={exportJson}
        onExportHtml={exportHtml}
        onAddFile={() => fileInput.current?.click()}
      />

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
        {active && !active.imageAssets && <div className="legacy-image-notice" role="status">
          <span>هذا التحليل محفوظ قبل دعم صور الشرائح. أعد رفع الملف لإنشاء تحليل جديد يتضمن الصور؛ سيبقى هذا التحليل وملاحظاته كما هي.</span>
          <button onClick={() => fileInput.current?.click()}>إعادة رفع العرض</button>
        </div>}

        {!active && <EmptyState
          dragging={dragging}
          progress={progress}
          setDragging={setDragging}
          onBrowse={() => fileInput.current?.click()}
          onFilesDropped={files => { void addFiles(files); }}
        />}

        {active && <>
          <AnalysisOverview
            active={active}
            findingCount={findings.length}
            severityCounts={severityCounts}
            severity={severity}
            onSeverityChange={setSeverity}
            topSections={topSections}
            sectionFilter={sectionFilter}
            onSectionChange={setSectionFilter}
            onShowFindings={() => setActiveTab('findings')}
          />
          <ReviewWorkspace
            active={active}
            analyses={analyses}
            findings={findings}
            filteredFindings={filteredFindings}
            sections={sections}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            search={search}
            onSearchChange={setSearch}
            severity={severity}
            onSeverityChange={setSeverity}
            sectionFilter={sectionFilter}
            onSectionFilterChange={setSectionFilter}
            slideFilter={slideFilter}
            onSlideFilterChange={setSlideFilter}
            onSelectFinding={setSelectedFinding}
            onOpenSlide={openSlide}
            onClearFilters={() => {
              setSeverity('الكل');
              setSectionFilter('الكل');
              setSlideFilter('');
              setSearch('');
            }}
            onExportJson={exportJson}
            onBeginNote={beginNote}
            onDeleteNote={note => setDeleteTarget(note)}
            onSelectAnalysis={activateAnalysis}
            onDeleteAnalysis={removeStudy}
          />
        </>}
        {loadingSaved && <div className="loading-state"><span className="skeleton-block" /><span className="skeleton-block short" />جارٍ استعادة عملك المحفوظ…</div>}
        {progress && active && <div className="processing-toast"><LoaderCircle size={17} className="spin" />جارٍ تحليل {progress.name} <span>{progress.index} / {progress.total}</span></div>}
        <footer className="page-footer"><span>وَرَق <i>·</i> مساحة محلية لمراجعة العروض</span><span>التحليل قائم على النص المستخرج من الملف، وقد لا يشمل النص داخل الصور.</span></footer>
      </main>

      <ReviewModals
        active={active}
        selectedFinding={selectedFinding}
        setSelectedFinding={setSelectedFinding}
        selectedSlide={selectedSlide}
        setSelectedSlide={setSelectedSlide}
        noteDraft={noteDraft}
        setNoteDraft={setNoteDraft}
        imageInput={imageInput}
        setNotice={setNotice}
        saveNote={saveNote}
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        removeNote={removeNote}
        deleteAnalysisTarget={deleteAnalysisTarget}
        setDeleteAnalysisTarget={setDeleteAnalysisTarget}
        confirmRemoveStudy={confirmRemoveStudy}
        beginNote={beginNote}
      />
    </div>
  );
}

export default App;
