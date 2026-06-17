import { useState } from 'react';
import { speakKorean } from '../services/ttsService.js';
import { SpeakerIcon } from '../../../shared/components/Icon.jsx';
import { cn } from '../../../shared/utils/classNames.js';

/** One phrase row: Korean + romanization + meaning, with a TTS button. */
export default function PhraseCard({ phrase }) {
  const [spoke, setSpoke] = useState(false);

  const play = () => {
    speakKorean(phrase.ko);
    setSpoke(true);
    setTimeout(() => setSpoke(false), 500);
  };

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold tracking-tight text-ink">{phrase.ko}</p>
        <p className="mt-0.5 text-xs font-semibold italic text-ink-faint">{phrase.ro}</p>
        <p className="mt-1 text-sm text-ink-soft">{phrase.en}</p>
      </div>
      <button
        type="button"
        aria-label="Play in Korean"
        onClick={play}
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-coral text-white shadow-coral transition-transform',
          spoke && 'scale-90',
        )}
      >
        <SpeakerIcon size={18} />
      </button>
    </div>
  );
}
