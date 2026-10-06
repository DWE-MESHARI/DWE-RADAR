import {
  ArrowDownToLine,
  FileJson,
  Plus,
  Presentation,
  ShieldCheck,
} from 'lucide-react';

type AppHeaderProps = {
  hasActiveAnalysis: boolean;
  onExportJson: () => void;
  onExportHtml: () => void;
  onAddFile: () => void;
};

export function AppHeader({
  hasActiveAnalysis,
  onExportJson,
  onExportHtml,
  onAddFile,
}: AppHeaderProps) {
  return (
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
          {hasActiveAnalysis && <>
            <button className="top-action desktop-only" onClick={onExportJson} data-testid="button-export-json"><FileJson size={16} /> JSON</button>
            <button className="top-action report-action" onClick={onExportHtml} data-testid="button-export-html"><ArrowDownToLine size={16} /><span className="desktop-only">تصدير التقرير</span><span className="mobile-only-label">تقرير</span></button>
          </>}
          <button className="add-file-button" onClick={onAddFile} data-testid="button-upload-top"><Plus size={17} /><span>عرض جديد</span></button>
        </div>
      </div>
    </header>
  );
}
