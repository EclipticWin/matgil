import { useState } from 'react';
import { cn } from '../utils/classNames.js';
import { ImagePlaceholderIcon } from './Icon.jsx';

export default function Thumbnail({ src, tint = '#FFE3D4', className, rounded = 'rounded-2xl' }) {
  const [imgError, setImgError] = useState(false);

  if (src && !imgError) {
    return (
      <div className={cn('shrink-0 overflow-hidden', rounded, className)}>
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn('flex shrink-0 items-center justify-center overflow-hidden text-ink/30', rounded, className)}
      style={{ background: tint }}
    >
      <ImagePlaceholderIcon size={28} />
    </div>
  );
}
