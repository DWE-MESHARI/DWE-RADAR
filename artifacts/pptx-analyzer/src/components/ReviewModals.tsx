import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  BookOpen,
  Check,
  ImagePlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { Finding, PresentationAnalysis, SlideRecord, UserNote } from '../lib/pptx';
import { severityTone, type NoteDraft } from '../lib/view';
import { SlideImageGallery } from './SlideImageGallery';

type ReviewModalsProps = {
  active: PresentationAnalysis | null;
  selectedFinding: Finding | null;
  setSelectedFinding: Dispatch<SetStateAction<Finding | null>>;
  selectedSlide: SlideRecord | null;
  setSelectedSlide: Dispatch<SetStateAction<SlideRecord | null>>;
  noteDraft: NoteDraft | null;
  setNoteDraft: Dispatch<SetStateAction<NoteDraft | null>>;
  imageInput: RefObject<HTMLInputElement | null>;
  setNotice: (notice: string) => void;
  saveNote: () => void;
  deleteTarget: UserNote | null;
  setDeleteTarget: Dispatch<SetStateAction<UserNote | null>>;
  removeNote: () => void;
  deleteAnalysisTarget: PresentationAnalysis | null;
  setDeleteAnalysisTarget: Dispatch<SetStateAction<PresentationAnalysis | null>>;
  confirmRemoveStudy: () => void;
  beginNote: (slideNumber?: number, quote?: string, note?: UserNote) => void;
};

export function ReviewModals({
  active,
  selectedFinding,
  setSelectedFinding,
  selectedSlide,
  setSelectedSlide,
  noteDraft,
  setNoteDraft,
  imageInput,
  setNotice,
  saveNote,
  deleteTarget,
  setDeleteTarget,
  removeNote,
  deleteAnalysisTarget,
  setDeleteAnalysisTarget,
  confirmRemoveStudy,
  beginNote,
}: ReviewModalsProps) {
  const imageSlideNumber = selectedFinding?.slideNumber || selectedSlide?.number;
  const imageSlide = active?.slides.find(slide => slide.number === imageSlideNumber);

  return (
    <>
      {(selectedFinding || selectedSlide) && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) { setSelectedFinding(null); setSelectedSlide(null); } }}>
        <section className="quote-modal" role="dialog" aria-modal="true" aria-labelledby="quote-title">
          <div className="modal-top"><div><span className="section-kicker">مرجع من الملف الأصلي</span><h2 id="quote-title">نص الشريحة</h2></div><button className="icon-button" onClick={() => { setSelectedFinding(null); setSelectedSlide(null); }} aria-label="إغلاق"><X size={19} /></button></div>
          <div className="quote-source"><span className="slide-number">{String((selectedFinding?.slideNumber || selectedSlide?.number) || 0).padStart(2, '0')}</span><div><strong>{active?.slides.find(slide => slide.number === (selectedFinding?.slideNumber || selectedSlide?.number))?.title}</strong><small>{active?.fileName}</small></div></div>
          {selectedFinding && <div className="finding-detail"><span className={`severity-tag ${severityTone[selectedFinding.severity]}`}>{selectedFinding.severity}</span><p>{selectedFinding.text}</p></div>}
          <blockquote className="quote-full">{selectedFinding?.evidence || selectedSlide?.text || 'لا يوجد نص مستخرج من هذه الشريحة.'}</blockquote>
          {imageSlide && <SlideImageGallery slide={imageSlide} assets={active?.imageAssets} />}
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
    </>
  );
}
