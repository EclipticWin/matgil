import { useState } from 'react';
import { speakKorean } from '../services/ttsService.js';
import { SpeakerIcon, HeartIcon } from '../../../shared/components/Icon.jsx';
import { cn } from '../../../shared/utils/classNames.js';

/** One phrase row: intent · Korean · romanization · note, with TTS and bookmark buttons. */
export default function PhraseCard({ phrase, onBookmark }) {
  const [spoke, setSpoke] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  const play = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!phrase.korean) return;
    speakKorean(phrase.korean);
    setSpoke(true);
    setTimeout(() => setSpoke(false), 500);
  };

  const handleBookmark = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (bookmarking || !onBookmark) return;
    setBookmarking(true);
    try {
      await onBookmark(phrase.id);
    } finally {
      setBookmarking(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold tracking-tight text-ink">{phrase.korean}</p>
        <p className="mt-0.5 text-xs font-semibold italic text-ink-faint">{phrase.romanization}</p>
        <p className="mt-1 text-sm text-ink-soft">{phrase.intentEn}</p>
        {phrase.note ? (
          <p className="mt-1 text-xs text-ink-faint">{phrase.note}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {onBookmark && (
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              aria-label={phrase.isBookmarked ? 'Remove saved phrase' : 'Save phrase'}
              onClick={handleBookmark}
              disabled={bookmarking}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl transition-transform active:scale-90',
                phrase.isBookmarked ? 'text-coral' : 'text-ink-faint',
                bookmarking && 'opacity-50',
              )}
            >
              <HeartIcon active={phrase.isBookmarked} size={20} />
            </button>
            {phrase.bookmarkCount > 0 && (
              <span className="text-[0.65rem] leading-none text-ink-faint">
                {phrase.bookmarkCount}
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          aria-label="Play in Korean"
          onClick={play}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-2xl bg-coral text-white transition-transform active:scale-90',
            spoke && 'scale-90',
          )}
        >
          <SpeakerIcon size={32} />
        </button>
      </div>
    </div>
  );
}
