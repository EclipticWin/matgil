import { useState } from 'react';
import { PHRASES, PHRASE_CATEGORIES } from '../features/phrases/data/phrases.js';
import PhraseCategoryTabs from '../features/phrases/components/PhraseCategoryTabs.jsx';
import PhraseCard from '../features/phrases/components/PhraseCard.jsx';
import VoiceHelpPlaceholder from '../features/phrases/components/VoiceHelpPlaceholder.jsx';
import Card from '../shared/components/Card.jsx';
import { SpeakerIcon } from '../shared/components/Icon.jsx';
import { isTTSSupported } from '../features/phrases/services/ttsService.js';
import PageShell from '../shared/components/PageShell.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import { cn } from '../shared/utils/classNames.js';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

export default function PhrasesPage() {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState('common');
  const [category, setCategory] = useState('waiting');

  const TOP_TABS = [
    { id: 'common', label: t('phrases.common') },
    { id: 'voice',  label: t('phrases.voice') },
  ];

  const phrases = PHRASES.filter((p) => p.category === category);

  return (
    <PageShell>
      <PageHeader title={t('phrases.title')} />

      {/* Top-level tab switcher */}
      <div className="mt-3 flex rounded-xl bg-ink/5 p-1">
        {TOP_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-bold transition-colors',
              activeTab === tab.id
                ? 'bg-white text-ink shadow-soft'
                : 'text-ink-soft',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'common' && (
        <>
          {isTTSSupported() && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-coral-tint px-3 py-1.5 text-[0.8rem] font-semibold text-coral-deep">
              <SpeakerIcon size={15} className="text-coral" /> {t('phrases.tapToHear')}
            </div>
          )}

          <div className="mt-4 min-w-0 max-w-full overflow-hidden">
            <PhraseCategoryTabs
              categories={PHRASE_CATEGORIES}
              value={category}
              onChange={setCategory}
            />
          </div>

          <Card className="mt-4 px-4 py-1">
            {phrases.map((phrase, i) => (
              <div key={phrase.id} className={i > 0 ? 'border-t border-ink/5' : ''}>
                <PhraseCard phrase={phrase} />
              </div>
            ))}
          </Card>
        </>
      )}

      {activeTab === 'voice' && <VoiceHelpPlaceholder />}
    </PageShell>
  );
}
