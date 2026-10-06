import {
  BookOpen,
  HardDrive,
  LoaderCircle,
  Plus,
  Upload,
} from 'lucide-react';

export type FileProgress = {
  name: string;
  index: number;
  total: number;
};

type EmptyStateProps = {
  dragging: boolean;
  progress: FileProgress | null;
  setDragging: (dragging: boolean) => void;
  onBrowse: () => void;
  onFilesDropped: (files: FileList) => void;
};

export function EmptyState({
  dragging,
  progress,
  setDragging,
  onBrowse,
  onFilesDropped,
}: EmptyStateProps) {
  return (
    <section className="empty-layout animate-in delay-1">
      <div
        className={`upload-zone empty-upload ${dragging ? 'dragging' : ''}`}
        onDragOver={event => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          onFilesDropped(event.dataTransfer.files);
        }}
        onClick={onBrowse}
        role="button"
        tabIndex={0}
        onKeyDown={event => event.key === 'Enter' && onBrowse()}
        data-testid="dropzone-pptx"
      >
        <div className="upload-illustration"><Upload size={25} /></div>
        <h2>ابدأ بعرضك الأول</h2>
        <p>اسحب ملف PowerPoint إلى هنا، أو اختره من جهازك.<br />يمكنك إضافة أكثر من ملف دفعة واحدة.</p>
        <button
          className="primary-button"
          onClick={event => { event.stopPropagation(); onBrowse(); }}
          data-testid="button-choose-file"
        >
          <Plus size={17} />اختيار ملفات العرض
        </button>
        <span className="file-hint">ملفات .pptx فقط · يُعالج المحتوى على جهازك</span>
        {progress && <div className="progress-line"><LoaderCircle size={16} className="spin" />جارٍ قراءة {progress.name} · {progress.index} من {progress.total}</div>}
      </div>
      <div className="empty-aside">
        <div className="empty-note"><div className="empty-note-symbol"><BookOpen size={18} /></div><div><h3>من النص إلى الملاحظة</h3><p>تصفّح النص المستخرج من الشرائح، وافتح كل اقتباس في موضعه قبل تدوين ملاحظتك.</p></div></div>
        <div className="empty-note"><div className="empty-note-symbol warm"><HardDrive size={18} /></div><div><h3>خصوصية من البداية</h3><p>لا رفع إلى خادم ولا حساب سحابي. تبقى التحليلات والمرفقات في تخزين المتصفح.</p></div></div>
        <div className="method-card"><span className="method-index">مبدأ المراجعة</span><p>المؤشرات قواعد نصية محلية قابلة للتحقق، وليست حكمًا على جودة العرض.</p></div>
      </div>
    </section>
  );
}
