import { useState } from 'react';
import { cn } from '../utils/classNames.js';
import { ImagePlaceholderIcon } from './Icon.jsx';

export default function Thumbnail({ src, tint = '#FFE3D4', className, rounded = 'rounded-2xl' }) {
  const [imgError, setImgError] = useState(false);

  // Every caller passing a real `src` is a public-data restaurant photo (see
  // docs/64) — shown in full via object-contain (never cropped with
  // object-cover) inside whatever aspect-ratio box the caller's className sets
  // (aspect-[4/3] for the current source images' actual 940x705 shape). No
  // default background here — the caller's className supplies whichever
  // existing page/card background token surrounds it, so the object-contain
  // letterbox (only visible if a given image isn't exactly 4:3) blends with
  // its actual surroundings instead of a hardcoded color.
  // Deliberately ignores the `rounded` prop here (unlike the placeholder
  // branch below, which callers opt out of via `rounded=""`) — public-data
  // images are shown with square corners, since KOGL Type 3's
  // no-modification condition covers rounding/cropping the image itself, not
  // just filters or text overlays.
  if (src && !imgError) {
    return (
      <div className={cn('shrink-0 overflow-hidden', className)}>
        <img
          src={src}
          alt=""
          className="h-full w-full object-contain"
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
