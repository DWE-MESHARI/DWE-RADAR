import type {
  ExtractedSlide,
  Finding,
  FindingKind,
  FindingSeverity,
  PresentationAsset,
  PresentationAnalysis,
} from "./types";

const CATEGORY_RULES: Array<[string, RegExp]> = [
  ["السلامة", /خطر|سلامة|حاجز|ساتر|كبار السن|الأطفال|الاطفال|إصابة|اصابة|سطح/],
  ["الكهرباء والتكييف", /كهرب|أفياش|افياش|مكيف|تكييف|تمديد كهربائي|صندوق الكهرباء/],
  ["المياه والسباكة", /مياه|الماء|خزان|مواسير|سباكة|تسرب|مغسلة|صرف صحي|حمام/],
  ["الإنشاءات", /خرسانة|خرساني|صبة|صبّة|جدار|طوب|شروخ|شقوق|تشققات|أسوار|اسوار|مخطط|إنشائي|انشائي/],
  ["التشطيبات", /بلاط|دهان|ديكور|زجاج|درابزين|أبواب|ابواب|أسقف|اسقف|واجهات|شبابيك/],
  ["التواصل مع العملاء", /عميل|عملاء|بروشور|التنويه|المعلومات|شكوى|شكاوى|شكاوي/],
  ["التشغيل والمعاينة", /زيارة|زيارات|معاينة|فحص|مقاول|استلام|تنظيف|مخلفات|مستودع/],
];

const HIGH_RISK_TERMS =
  /خطر|إصابة|اصابة|تشققات|شروخ|تسرب|مكشوف|مكسور|متصدع|انهيار|غير آمن|غير امن|صعق/;
const ISSUE_TERMS =
  /مشكلة|مشاكل|شكوى|شكاوى|شكاوي|غير مكتمل|نقص|مفقود|عدم وجود|غير مناسب|غير مطابقة|غير مطابق|اختلاف|تفاوت|تأخير|مخلفات|تشققات|شروخ|تسرب|خطر|مكسور|مائلة|مائل|ضعيفة|ضعيف|قصور|خلل|عيب|لا يوجد|لايمكن|لا يمكن/;
const ACTION_TERMS = /الإجراء المقترح|الاجراء المقترح|يوصى|يُوصى|التوصية|ينبغي|الرجاء|يرجى/;
const LABEL_PATTERN =
  /(الملاحظة|السبب المحتمل|الإجراء المقترح|الاجراء المقترح)\s*[:：-]?\s*/g;

function categoryFor(text: string): string {
  return CATEGORY_RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? "ملاحظات عامة";
}

function severityFor(text: string, kind: FindingKind): FindingSeverity {
  if (kind === "توصية") return "منخفض";
  if (HIGH_RISK_TERMS.test(text)) return "مرتفع";
  if (ISSUE_TERMS.test(text)) return "متوسط";
  return "منخفض";
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[\s:：،-]+|[\s،]+$/g, "").trim();
}

function finding(
  slide: ExtractedSlide,
  text: string,
  kind: FindingKind,
  index: number,
): Finding {
  const cleaned = cleanText(text);
  return {
    id: `${slide.number}-${kind}-${index}-${cleaned.slice(0, 16)}`,
    slideNumber: slide.number,
    section: categoryFor(cleaned || slide.text),
    kind,
    severity: severityFor(cleaned, kind),
    text: cleaned,
    evidence: cleaned,
  };
}

function labeledFindings(slide: ExtractedSlide): Finding[] {
  const matches = Array.from(slide.text.matchAll(LABEL_PATTERN));
  if (matches.length === 0) return [];
  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? slide.text.length;
      const label = match[1];
      const body = cleanText(slide.text.slice(start, end));
      if (body.length < 8) return undefined;
      const kind: FindingKind =
        label.includes("الإجراء") || label.includes("الاجراء")
          ? "توصية"
          : "ملاحظة";
      return finding(slide, body, kind, index);
    })
    .filter((item): item is Finding => Boolean(item));
}

function sentenceFindings(slide: ExtractedSlide, startIndex: number): Finding[] {
  const fragments = slide.text
    .replace(/([.!؟؛])\s+/g, "$1\n")
    .split(/\n+/)
    .map(cleanText)
    .filter((part) => part.length >= 20 && ISSUE_TERMS.test(part));

  return fragments.slice(0, 6).map((fragment, index) =>
    finding(slide, fragment, "مشكلة", startIndex + index),
  );
}

export function analyzeSlides(
  fileName: string,
  slides: ExtractedSlide[],
  imageAssets: Record<string, PresentationAsset> = {},
): PresentationAnalysis {
  const records = slides.map((slide) => ({
    number: slide.number,
    title: slide.title || `الشريحة ${slide.number}`,
    text: slide.text,
    imageIds: slide.imageIds ?? [],
  }));
  const findings = slides.flatMap((slide) => {
    const labeled = labeledFindings(slide);
    const generic = sentenceFindings(slide, labeled.length);
    const seen = new Set(labeled.map((item) => item.text));
    return [
      ...labeled,
      ...generic.filter((item) => !seen.has(item.text)),
    ];
  });

  return {
    id: crypto.randomUUID(),
    fileName,
    createdAt: new Date().toISOString(),
    slideCount: slides.length,
    slides: records,
    imageAssets,
    findings,
    notes: [],
  };
}

export function getAnalysisSummary(analyses: PresentationAnalysis[]) {
  const findings = analyses.flatMap((analysis) => analysis.findings);
  const slides = analyses.flatMap((analysis) => analysis.slides);
  const counts = { مرتفع: 0, متوسط: 0, منخفض: 0 };
  const categories = new Map<string, number>();
  const kinds = { مشكلة: 0, ملاحظة: 0, توصية: 0 };

  for (const item of findings) {
    counts[item.severity] += 1;
    categories.set(item.section, (categories.get(item.section) ?? 0) + 1);
    kinds[item.kind] += 1;
  }

  return {
    fileCount: analyses.length,
    slideCount: slides.length,
    findingCount: findings.length,
    emptySlideCount: slides.filter((slide) => !slide.text.trim()).length,
    priorityCounts: counts,
    kindCounts: kinds,
    categories: Array.from(categories.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    topFindings: findings
      .filter((item) => item.kind === "مشكلة")
      .slice()
      .sort((a, b) => {
        const severityRank = { مرتفع: 0, متوسط: 1, منخفض: 2 };
        return severityRank[a.severity] - severityRank[b.severity];
      })
      .slice(0, 5),
  };
}

export function makeAnalysis(
  fileName: string,
  slides: ExtractedSlide[],
): PresentationAnalysis {
  return analyzeSlides(fileName, slides);
}
