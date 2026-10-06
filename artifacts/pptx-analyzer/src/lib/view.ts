export type NoteDraft = {
  id?: string;
  text: string;
  slideNumber?: number;
  quote?: string;
  imageDataUrl?: string;
};

export const severityTone: Record<string, string> = {
  مرتفع: 'severity-high',
  متوسط: 'severity-mid',
  منخفض: 'severity-low',
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}
