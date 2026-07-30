import Button from '../../../shared/components/Button.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

/** Layers B+C of the guest teaser card (see PublicRouteTeaserCard/
 *  PublicPlaceTeaserCard for layer A, the skeleton underneath) — two
 *  separate `absolute inset-0` siblings, not one combined div: layer B
 *  (z-[1]) is the blur/scrim only, carrying no text, so the skeleton
 *  showing through it stays a plain blur; layer C (z-[2]) carries only the
 *  sign-in copy/button on a fully transparent background, so it never adds
 *  a second opaque panel behind the text. bg-white/32 (a thin neutral white
 *  tint, not any warmer/opaque surface color) plus
 *  backdrop-blur-[4px] keeps the real card's white background visually
 *  unchanged while making layer A's already-soft skeleton unreadable
 *  underneath it, so it never visually competes with the CTA text sitting
 *  on top. The title's drop-shadow is a soft WHITE shadow (not a dark one)
 *  — it lifts the text a bit further off the blurred skeleton without
 *  adding a second opaque background box behind it. Kept as one shared
 *  component (not inlined per caller) since this copy/button is identical
 *  between the routes and places teasers — only each caller's own skeleton
 *  body (layer A) differs enough to stay separate. */
export default function PublicFeedTeaserOverlay({ onSignInClick }) {
  const { t } = useLocale();
  return (
    <>
      <div className="absolute inset-0 z-[1] bg-white/32 backdrop-blur-[4px]" aria-hidden="true" />
      <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1.5 px-6 text-center">
        <p className="font-display text-[0.85rem] font-bold text-ink drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">{t('publicFeed.seeMoreTitle')}</p>
        <p className="max-w-[15rem] text-[0.72rem] leading-snug text-ink-soft">{t('publicFeed.seeMoreDescription')}</p>
        <Button className="mt-1 !h-10 !px-4 !text-[0.8rem]" onClick={onSignInClick}>
          {t('publicFeed.signInToSeeMore')}
        </Button>
      </div>
    </>
  );
}
