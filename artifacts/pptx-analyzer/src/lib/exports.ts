import type { PresentationAnalysis } from './pptx';
import { formatDate } from './view';

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

export function downloadAnalysisJson(analysis: PresentationAnalysis) {
  const name = `${analysis.fileName.replace(/\.pptx$/i, '')}-تحليل.json`;
  downloadFile(name, JSON.stringify(analysis, null, 2), 'application/json;charset=utf-8');
}

export function downloadAnalysisReport(analysis: PresentationAnalysis) {
  const summary = analysis.findings.reduce((all, item) => {
    all[item.severity] = (all[item.severity] || 0) + 1;
    return all;
  }, {} as Record<string, number>);
  const sectionCounts = analysis.findings.reduce((all, item) => {
    all[item.section] = (all[item.section] || 0) + 1;
    return all;
  }, {} as Record<string, number>);
  const sectionsHtml = Object.entries(sectionCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `<li>${escapeHtml(name)}: ${count}</li>`)
    .join('');
  const findingsHtml = analysis.findings.map(item =>
    `<article><small>الشريحة ${item.slideNumber} · ${escapeHtml(item.kind)} · ${escapeHtml(item.severity)}</small><h3>${escapeHtml(item.text)}</h3><blockquote>${escapeHtml(item.evidence)}</blockquote></article>`,
  ).join('');
  const notesHtml = analysis.notes.map(note =>
    `<article><small>${note.slideNumber ? `الشريحة ${note.slideNumber} · ` : ''}${escapeHtml(formatDate(note.createdAt))}</small><p>${escapeHtml(note.text)}</p>${note.quote ? `<blockquote>${escapeHtml(note.quote)}</blockquote>` : ''}${note.imageDataUrl ? `<img src="${escapeHtml(note.imageDataUrl)}" alt="صورة مرفقة">` : ''}</article>`,
  ).join('');
  const slidesHtml = analysis.slides.map(slide => {
    const imagesHtml = (slide.imageIds ?? []).map((imageId, index) => {
      const asset = analysis.imageAssets?.[imageId];
      if (asset?.dataUrl && !asset.error) {
        return `<figure><img src="${escapeHtml(asset.dataUrl)}" alt="صورة الشريحة ${slide.number}: ${escapeHtml(asset.fileName)}"><figcaption>${escapeHtml(asset.fileName)} · ${index + 1}</figcaption></figure>`;
      }
      return `<figure><p>صورة الشريحة ${slide.number}: ${escapeHtml(asset?.fileName || `صورة ${index + 1}`)}</p><small>${escapeHtml(asset?.error || 'هذه الصورة غير مضمّنة ضمن ملف العرض.')}</small></figure>`;
    }).join('');
    return `<article><small>الشريحة ${slide.number}</small><h3>${escapeHtml(slide.title)}</h3><p>${escapeHtml(slide.text).replace(/\n/g, '<br>')}</p>${imagesHtml}</article>`;
  }).join('');
  const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>تقرير ${escapeHtml(analysis.fileName)}</title><style>body{font:17px/1.8 system-ui,sans-serif;max-width:1000px;margin:40px auto;padding:0 22px;background:#fff;color:#303532}header{padding:28px 0;border-bottom:1px solid #f0e5db}article{background:#fff;padding:20px;margin:14px 0;border:1px solid #f0e5db;border-radius:12px}small{color:#69736e}blockquote{border-right:3px solid #e96826;padding:8px 14px;background:#fff3ea;margin:12px 0}h1{font-size:28px}img{display:block;max-width:100%;max-height:600px;height:auto;object-fit:contain;margin:12px 0;border:1px solid #f0e5db;border-radius:8px}figure{margin:16px 0;padding:12px;border:1px solid #ece8e2;border-radius:10px;background:#f1f2ef}figcaption{font-size:13px;color:#69736e}</style><header><h1>سجلّ المراجعة</h1><p>${escapeHtml(analysis.fileName)} · ${analysis.slideCount} شريحة · ${escapeHtml(formatDate(analysis.createdAt))}</p><p>تقرير محلي من النص المستخرج والملاحظات المحفوظة في هذا المتصفح. المؤشرات قواعد نصية أولية وتحتاج إلى مراجعتك.</p></header><h2>ملخص الأولويات</h2><p>مرتفع: ${summary['مرتفع'] || 0} · متوسط: ${summary['متوسط'] || 0} · منخفض: ${summary['منخفض'] || 0}</p><h2>توزيع المجالات</h2><ul>${sectionsHtml || '<li>لا توجد مؤشرات مصنفة.</li>'}</ul><h2>ملاحظات المراجعة (${analysis.notes.length})</h2>${notesHtml || '<p>لا توجد ملاحظات مضافة.</p>'}<h2>المؤشرات المرصودة (${analysis.findings.length})</h2>${findingsHtml || '<p>لم تظهر مؤشرات نصية محلية في الملف.</p>'}<h2>نص الشرائح</h2>${slidesHtml}</html>`;

  downloadFile(`${analysis.fileName.replace(/\.pptx$/i, '')}-تقرير.html`, html, 'text/html;charset=utf-8');
}
