import {
  Clock3,
  FileText,
  FileWarning,
  Presentation,
  ShieldCheck,
  SlidersHorizontal,
  StickyNote,
} from 'lucide-react';
import type { PresentationAnalysis } from '../lib/pptx';
import { formatDate, severityTone } from '../lib/view';

type AnalysisOverviewProps = {
  active: PresentationAnalysis;
  findingCount: number;
  severityCounts: Record<string, number>;
  severity: string;
  onSeverityChange: (severity: string) => void;
  topSections: [string, number][];
  sectionFilter: string;
  onSectionChange: (section: string) => void;
  onShowFindings: () => void;
};

export function AnalysisOverview({
  active,
  findingCount,
  severityCounts,
  severity,
  onSeverityChange,
  topSections,
  sectionFilter,
  onSectionChange,
  onShowFindings,
}: AnalysisOverviewProps) {
  return (
    <>
      <section className="stats-grid animate-in delay-1">
        <div className="stat-card"><span>عدد الشرائح</span><strong>{active.slideCount}</strong><small>نصوص مستخرجة محليًا</small><div className="stat-icon"><Presentation size={18} /></div></div>
        <div className="stat-card"><span>مؤشرات للمراجعة</span><strong>{findingCount}</strong><small>قواعد نصية قابلة للتحقق</small><div className="stat-icon amber"><FileWarning size={18} /></div></div>
        <div className="stat-card"><span>ملاحظاتك</span><strong>{active.notes.length}</strong><small>مرتبطة بالعرض الحالي</small><div className="stat-icon blue"><StickyNote size={18} /></div></div>
        <div className="stat-card saved-stat"><span>الحفظ المحلي</span><strong className="saved-value"><span className="saved-dot" />محفوظ</strong><small>أضيف في {formatDate(active.createdAt)}</small><div className="stat-icon green"><ShieldCheck size={18} /></div></div>
      </section>

      <section className="charts-row animate-in delay-2">
        <div className="panel chart-panel">
          <div className="panel-heading"><div><span className="section-kicker">توزيع المؤشرات</span><h2>ما الذي يستحق نظرة ثانية؟</h2></div><SlidersHorizontal size={18} className="heading-glyph" /></div>
          <div className="severity-chart">
            {(['مرتفع', 'متوسط', 'منخفض'] as const).map((name, index) => {
              const count = severityCounts[name] || 0;
              const percent = findingCount ? Math.max(count ? 8 : 0, count / findingCount * 100) : 0;
              return <button className={`chart-line ${severity === name ? 'chart-selected' : ''}`} key={name} onClick={() => onSeverityChange(severity === name ? 'الكل' : name)} data-testid={`filter-chart-${index}`}>
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
              return <button className={`chart-line category-chart-line ${selected ? 'chart-selected' : ''}`} key={name} onClick={() => { onSectionChange(selected ? 'الكل' : name); onShowFindings(); }}>
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
    </>
  );
}
