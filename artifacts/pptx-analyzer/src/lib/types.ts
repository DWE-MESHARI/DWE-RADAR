export type FindingKind = "مشكلة" | "ملاحظة" | "توصية";
export type FindingSeverity = "مرتفع" | "متوسط" | "منخفض";

export interface SlideRecord {
  number: number;
  title: string;
  text: string;
  imageIds?: string[];
}

export interface PresentationAsset {
  id: string;
  fileName: string;
  contentType: string;
  dataUrl?: string;
  externalUrl?: string;
  error?: string;
}

export interface Finding {
  id: string;
  slideNumber: number;
  section: string;
  kind: FindingKind;
  severity: FindingSeverity;
  text: string;
  evidence: string;
}

export interface UserNote {
  id: string;
  text: string;
  slideNumber?: number;
  quote?: string;
  imageDataUrl?: string;
  createdAt: string;
}

export interface PresentationAnalysis {
  id: string;
  fileName: string;
  createdAt: string;
  slideCount: number;
  slides: SlideRecord[];
  imageAssets?: Record<string, PresentationAsset>;
  findings: Finding[];
  notes: UserNote[];
}

export interface ExtractedSlide {
  number: number;
  title: string;
  text: string;
  imageIds?: string[];
}

export interface PowerPointReadResult {
  slides: ExtractedSlide[];
  imageAssets: Record<string, PresentationAsset>;
}
