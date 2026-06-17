import { useState } from 'react';
import { PHRASES } from '../features/phrases/data/phrases.js';
import PhraseCategoryTabs from '../features/phrases/components/PhraseCategoryTabs.jsx';
import PhraseCard from '../features/phrases/components/PhraseCard.jsx';
import Card from '../shared/components/Card.jsx';
import { SpeakerIcon } from '../shared/components/Icon.jsx';

/** Phrases tab: situational Korean phrases with text-to-speech. */
export default function PhrasesPage() {
  const [category, setCategory] = useState('arriving');
  const phrases = PHRASES.filter((p) => p.category === category);

  return (
    <div className="px-5 pb-6 pt-6">
      <h1 className="font-display text-[1.75rem] font-bold tracking-tight text-ink">Useful phrases</h1>
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-coral-tint px-3 py-1.5 text-[0.8rem] font-semibold text-coral-deep">
        <SpeakerIcon size={15} className="text-coral" /> Tap to hear it in Korean
      </div>

      <div className="mt-5">
        <PhraseCategoryTabs value={category} onChange={setCategory} />
      </div>

      <Card className="mt-4 px-4 py-1">
        {phrases.map((phrase, i) => (
          <div key={phrase.id} className={i > 0 ? 'border-t border-ink/5' : ''}>
            <PhraseCard phrase={phrase} />
          </div>
        ))}
      </Card>
    </div>
  );
}
