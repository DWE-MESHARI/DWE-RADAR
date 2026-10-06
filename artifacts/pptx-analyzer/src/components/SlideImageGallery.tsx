import { useState } from 'react';
import type { PresentationAsset, SlideRecord } from '../lib/pptx';

type SlideImageGalleryProps = {
  slide: SlideRecord;
  assets?: Record<string, PresentationAsset>;
  compact?: boolean;
};

function SlideImageItem({
  asset,
  slideNumber,
  index,
  compact,
}: {
  asset: PresentationAsset | undefined;
  slideNumber: number;
  index: number;
  compact: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const label = asset?.fileName || `صورة ${index + 1}`;
  const alt = `صورة الشريحة ${slideNumber}: ${label}`;
  const externalUrl = asset?.externalUrl;
  const safeExternalUrl = externalUrl && /^https?:\/\//i.test(externalUrl)
    ? externalUrl
    : undefined;

  return (
    <figure className={`slide-image-card ${compact ? 'compact' : ''}`} data-testid={`slide-image-${slideNumber}-${index + 1}`}>
      {asset?.dataUrl && !asset.error && !failed ? (
        <a className="slide-image-link" href={asset.dataUrl} target="_blank" rel="noreferrer" aria-label={`فتح ${alt} بالحجم الأصلي`}>
          <img
            src={asset.dataUrl}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        </a>
      ) : (
        <div className="slide-image-unavailable" role="img" aria-label={alt}>
          <span>{asset?.error || (externalUrl ? 'هذه الصورة مرتبطة بمصدر خارجي وليست مضمّنة في الملف.' : 'تعذّر عرض الصورة المضمّنة.')}</span>
          {safeExternalUrl && <a href={safeExternalUrl} target="_blank" rel="noreferrer">فتح المصدر الخارجي</a>}
          {asset?.dataUrl && <a href={asset.dataUrl} download={asset.fileName}>تنزيل الملف الأصلي</a>}
        </div>
      )}
      <figcaption>{label}{asset?.contentType ? <small>{asset.contentType}</small> : null}</figcaption>
    </figure>
  );
}

export function SlideImageGallery({
  slide,
  assets,
  compact = false,
}: SlideImageGalleryProps) {
  const imageIds = slide.imageIds ?? [];
  if (imageIds.length === 0) return null;

  return (
    <div className={`slide-image-gallery ${compact ? 'compact' : ''}`} aria-label={`صور الشريحة ${slide.number}`}>
      {imageIds.map((imageId, index) => (
        <SlideImageItem
          key={`${slide.number}-${imageId}-${index}`}
          asset={assets?.[imageId]}
          slideNumber={slide.number}
          index={index}
          compact={compact}
        />
      ))}
    </div>
  );
}
