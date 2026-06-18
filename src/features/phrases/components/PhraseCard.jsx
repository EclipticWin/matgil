import { useState } from 'react';
import { speakKorean } from '../services/ttsService.js';
import { SpeakerIcon } from '../../../shared/components/Icon.jsx';
import { cn } from '../../../shared/utils/classNames.js';

/** One phrase row: intent · Korean · romanization · note, with a TTS button. */
export default function PhraseCard({ phrase }) {
  const [spoke, setSpoke] = useState(false);

  const play = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!phrase.korean) return;
    speakKorean(phrase.korean);
    setSpoke(true);
    setTimeout(() => setSpoke(false), 500);
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
      <button
        type="button"
        aria-label="Play in Korean"
        onClick={play}
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-coral text-white transition-transform active:scale-90',
          spoke && 'scale-90',
        )}
      >
        <SpeakerIcon size={32} />
      </button>
    </div>
  );
}
