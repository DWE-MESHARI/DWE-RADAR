import {
  ArrowDownToLine,
  ChevronDown,
  FileText,
  Pencil,
  Plus,
  Quote,
  Search,
  ShieldCheck,
  StickyNote,
  Trash2,
} from 'lucide-react';
import type { Finding, PresentationAnalysis, UserNote } from '../lib/pptx';
import { formatDate, severityTone } from '../lib/view';
import { SlideImageGallery } from './SlideImageGallery';

type ReviewWorkspaceProps = {
  active: PresentationAnalysis;
  analyses: PresentationAnalysis[];
  findings: Finding[];
  filteredFindings: Finding[];
  sections: string[];
  activeTab: 'findings' | 'slides';
  onTabChange: (tab: 'findings' | 'slides') => void;
  search: string;
  onSearchChange: (value: string) => void;
  severity: string;
  onSeverityChange: (value: string) => void;
  sectionFilter: string;
  onSectionFilterChange: (value: string) => void;
  slideFilter: string;
  onSlideFilterChange: (value: string) => void;
  onSelectFinding: (finding: Finding) => void;
  onOpenSlide: (slideNumber: number) => void;
  onClearFilters: () => void;
  onExportJson: () => void;
  onBeginNote: (slideNumber?: number, quote?: string, note?: UserNote) => void;
  onDeleteNote: (note: UserNote) => void;
  onSelectAnalysis: (id: string) => void;
  onDeleteAnalysis: (id: string) => void;
};

export function ReviewWorkspace({
  active,
  analyses,
  findings,
  filteredFindings,
  sections,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  severity,
  onSeverityChange,
  sectionFilter,
  onSectionFilterChange,
  slideFilter,
  onSlideFilterChange,
  onSelectFinding,
  onOpenSlide,
  onClearFilters,
  onExportJson,
  onBeginNote,
  onDeleteNote,
  onSelectAnalysis,
  onDeleteAnalysis,
}: ReviewWorkspaceProps) {
  return (
    <section className="main-grid animate-in delay-3">
      <div className="panel findings-panel">
        <div className="content-header">
          <div><span className="section-kicker">سجلّ المراجعة</span><h2>محتوى العرض</h2></div>
          <div className="count-badge">{activeTab === 'findings' ? `${filteredFindings.length} مؤشر` : `${active.slides.length} شريحة`}</div>
        </div>
        <div className="tabs-row" role="tablist">
          <button className={activeTab === 'findings' ? 'tab-active' : ''} onClick={() => onTabChange('findings')} role="tab" data-testid="tab-findings">المؤشرات <span>{findings.length}</span></button>
          <button className={activeTab === 'slides' ? 'tab-active' : ''} onClick={() => onTabChange('slides')} role="tab" data-testid="tab-slides">نص الشرائح <span>{active.slides.length}</span></button>
        </div>
        {activeTab === 'findings' ? <>
          <div className="filters">
            <label className="search-field"><Search size={16} /><input value={search} onChange={event => onSearchChange(event.target.value)} placeholder="ابحث في المؤشرات..." aria-label="ابحث في المؤشرات" data-testid="input-search-findings" /></label>
            <label className="filter-select"><span>الأهمية</span><select value={severity} onChange={event => onSeverityChange(event.target.value)} aria-label="تصفية حسب الأهمية" data-testid="select-severity"><option>الكل</option><option>مرتفع</option><option>متوسط</option><option>منخفض</option></select><ChevronDown size={13} /></label>
            <label className="filter-select"><span>القسم</span><select value={sectionFilter} onChange={event => onSectionFilterChange(event.target.value)} aria-label="تصفية حسب القسم" data-testid="select-section"><option>الكل</option>{sections.map(section => <option key={section}>{section}</option>)}</select><ChevronDown size={13} /></label>
            <label className="slide-filter"><span>الشريحة</span><input type="number" min="1" max={active.slideCount} placeholder="الكل" value={slideFilter} onChange={event => onSlideFilterChange(event.target.value)} aria-label="تصفية برقم الشريحة" data-testid="input-filter-slide" /></label>
          </div>
          {filteredFindings.length ? <div className="finding-list">
            {filteredFindings.map(finding => <article className="finding-row" key={finding.id} data-testid={`finding-${finding.id}`}>
              <button className="finding-main" onClick={() => onSelectFinding(finding)} data-testid={`button-open-finding-${finding.id}`}>
                <div className="finding-meta"><span className={`severity-tag ${severityTone[finding.severity]}`}>{finding.severity}</span><span className="finding-kind">{finding.kind}</span><span className="finding-category">{finding.section}</span><span className="slide-tag">شريحة {finding.slideNumber}</span></div>
                <h3>{finding.text}</h3>
                <p className="evidence-preview"><Quote size={13} />{finding.evidence}</p>
              </button>
              <button className="open-quote" onClick={() => onSelectFinding(finding)} aria-label={`فتح الاقتباس من الشريحة ${finding.slideNumber}`} data-testid={`button-quote-${finding.id}`}><ArrowDownToLine size={16} /></button>
            </article>)}
          </div> : <div className="empty-results"><div className="empty-results-icon"><Search size={20} /></div><h3>{findings.length ? 'لا نتائج بهذه التصفية' : 'لا توجد مؤشرات نصية'}</h3><p>{findings.length ? 'جرّب تغيير الأهمية أو القسم أو رقم الشريحة أو عبارة البحث.' : 'لم ترصد القواعد المحلية كلمات أو أنماطًا تستحق الإشارة. يمكنك مراجعة نص الشرائح وإضافة ملاحظاتك.'}</p>{findings.length > 0 && <button className="text-button" onClick={onClearFilters}>إزالة التصفية</button>}</div>}
        </> : <div className="slide-list">
          {active.slides.map(slide => <article className="slide-record" key={slide.number}>
            <button className="slide-row" onClick={() => onOpenSlide(slide.number)} data-testid={`button-open-slide-${slide.number}`}>
              <span className="slide-number">{String(slide.number).padStart(2, '0')}</span><span className="slide-content"><strong>{slide.title}</strong><small>{slide.text.slice(0, 150) || 'لم يُستخرج نص من هذه الشريحة'}{slide.text.length > 150 ? '…' : ''}</small></span><span className="slide-open-label">فتح النص <ChevronDown size={14} /></span>
            </button>
            <SlideImageGallery slide={slide} assets={active.imageAssets} />
          </article>)}
        </div>}
        <div className="panel-footer"><span><ShieldCheck size={14} /> النصوص محفوظة على هذا الجهاز فقط</span><button onClick={onExportJson} data-testid="button-footer-export">تصدير البيانات <ArrowDownToLine size={14} /></button></div>
      </div>

      <aside className="right-rail">
        <div className="panel notes-panel">
          <div className="notes-heading"><div><span className="section-kicker">مساحة خاصة</span><h2>ملاحظات المراجع</h2></div><div className="notes-count">{active.notes.length}</div></div>
          <p className="notes-intro">أضف قرارًا أو سؤالًا أو سياقًا بجانب العرض.</p>
          <button className="new-note-button" onClick={() => onBeginNote()} data-testid="button-add-note"><Plus size={16} />ملاحظة جديدة</button>
          {active.notes.length ? <div className="notes-list">{active.notes.map(note => <article className="note-card" key={note.id} data-testid={`note-${note.id}`}>
            <div className="note-card-top"><span>{note.slideNumber ? `شريحة ${note.slideNumber}` : 'ملاحظة عامة'}</span><div><button onClick={() => onBeginNote(undefined, undefined, note)} aria-label="تحرير الملاحظة" data-testid={`button-edit-note-${note.id}`}><Pencil size={14} /></button><button onClick={() => onDeleteNote(note)} aria-label="حذف الملاحظة" data-testid={`button-delete-note-${note.id}`}><Trash2 size={14} /></button></div></div>
            <p>{note.text}</p>{note.quote && <blockquote>{note.quote}</blockquote>}{note.imageDataUrl && <img src={note.imageDataUrl} alt="مرفق الملاحظة" className="note-image" />}
            <time>{formatDate(note.createdAt)}</time>
          </article>)}</div> : <div className="notes-empty"><div className="note-empty-mark"><StickyNote size={18} /></div><p>مساحة ملاحظاتك جاهزة.<br />اربطها بشريحة أو اتركها عامة.</p></div>}
        </div>
        <div className="local-storage-card"><span className="storage-icon"><FileText size={16} /></span><div><strong>محفوظ محليًا</strong><p>يمكنك العودة إلى عملك من هذا المتصفح.</p></div><span className="storage-dot" /></div>
        {analyses.length > 1 && <div className="panel recent-panel"><div className="recent-heading"><span className="section-kicker">أعمال محفوظة</span><span>{analyses.length}</span></div>{analyses.filter(item => item.id !== active.id).map(item => <div className="recent-item" key={item.id}><button onClick={() => onSelectAnalysis(item.id)} data-testid={`button-restore-${item.id}`}><FileText size={15} /><span>{item.fileName}</span></button><button aria-label="حذف التحليل" onClick={() => onDeleteAnalysis(item.id)}><Trash2 size={14} /></button></div>)}</div>}
      </aside>
    </section>
  );
}
