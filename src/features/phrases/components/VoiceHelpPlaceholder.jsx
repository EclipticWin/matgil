import { useState } from 'react';
import { MicIcon, SpeakerIcon, AiSparklesIcon } from '../../../shared/components/Icon.jsx';
import { speakKorean } from '../services/ttsService.js';
import { supabase } from '../../../lib/supabase.js';
import {
  isSpeechRecognitionSupported,
  startListening,
  stopListening,
} from '../services/speechRecognitionService.js';
import { cn } from '../../../shared/utils/classNames.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { pickTranslated } from '../../../shared/i18n/localeFallback.js';

// The example card's Korean phrase, Korean reply, and romanization are shown
// to any tourist regardless of UI language (they're what you'd actually hear/
// say in the restaurant — see dictionary.js's phrases.* keys for the same
// policy). Only the meaning/gloss text is locale-dependent.
const EXAMPLE_ORIGINAL_KO = '선불입니다.';
const EXAMPLE_MEANING_BY_LOCALE = {
  ko: '식사 전에 먼저 결제해야 한다는 뜻입니다.',
  en: 'You need to pay before eating.',
  'zh-CN': '表示需要在用餐前先付款。',
};
const EXAMPLE_REPLY_KO = '알겠어요.';
const EXAMPLE_REPLY_ROMANIZATION = 'Algeseoyo.';
// No 'ko' entry: a ko-locale user already reads the Korean reply directly, so
// this gloss line is only rendered for non-ko locales (see render below).
const EXAMPLE_REPLY_MEANING_BY_LOCALE = {
  en: 'Okay, I understand.',
  'zh-CN': '好的，我知道了。',
};

export default function VoiceHelpPlaceholder() {
  const { locale, t } = useLocale();
  const [status, setStatus] = useState('idle');
  // idle | listening | processing | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const speechSupported = isSpeechRecognitionSupported();

  function handleMicClick() {
    if (status === 'listening') {
      stopListening();
      setStatus('idle');
      return;
    }

    if (status === 'processing') return;

    setResult(null);
    setErrorMsg('');
    setStatus('listening');

    startListening({
      onResult: async (transcript) => {
        setStatus('processing');
        try {
          const { data, error } = await supabase.functions.invoke('mg-voice-help', {
            body: { transcript, userLanguage: locale, context: 'Korean restaurant' },
          });
          if (error) throw error;
          setResult(data);
          setStatus('done');
        } catch {
          setErrorMsg(t('phrases.voiceFailed'));
          setStatus('error');
        }
      },
      onError: (code) => {
        if (code === 'aborted') return;
        const msg = code === 'not-allowed' ? t('phrases.voiceDenied') : t('phrases.voiceError');
        setErrorMsg(msg);
        setStatus('error');
      },
    });
  }

  const isListening = status === 'listening';
  const isProcessing = status === 'processing';
  const isDone = status === 'done';
  const showCard = status === 'idle' || isDone;
  const micDisabled = !speechSupported || isProcessing;

  // Real analysis result (isDone) vs. the static example card — the Korean
  // phrase/reply/romanization stay Korean in both cases and across every UI
  // locale (see EXAMPLE_* comment above); only the meaning/gloss text follows
  // the current locale.
  const displayOriginal = isDone ? result.originalPhrase : EXAMPLE_ORIGINAL_KO;
  const displayMeaning = isDone
    ? result.meaning
    : pickTranslated(EXAMPLE_MEANING_BY_LOCALE, locale);
  const displayReplyKo = isDone ? result.suggestedReplyKo : EXAMPLE_REPLY_KO;
  const displayReplyRomanization = isDone ? result.suggestedReplyRomanization : EXAMPLE_REPLY_ROMANIZATION;
  // ko-locale users already read the Korean reply directly, so the reply's
  // translated gloss is only shown for non-ko locales.
  const displayReplyMeaning = locale === 'ko'
    ? null
    : (isDone ? result.suggestedReplyMeaning : pickTranslated(EXAMPLE_REPLY_MEANING_BY_LOCALE, locale)) || null;

  return (
    <div className="flex flex-col items-center px-4 pt-12 pb-8">

      {/* Mic button */}
      <button
        type="button"
        onClick={handleMicClick}
        disabled={micDisabled}
        aria-label={isListening ? 'Stop listening' : 'Record speech'}
        className={cn(
          'flex h-40 w-40 items-center justify-center rounded-full text-white transition-all',
          isListening ? 'bg-coral ring-8 ring-coral/25' : 'bg-coral',
          micDisabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <MicIcon size={60} />
      </button>

      {/* Status text */}
      <p className="mt-8 text-sm font-semibold text-ink-soft">
        {!speechSupported
          ? t('phrases.voiceUnsupported')
          : status === 'idle'       ? t('phrases.tapSpeak')
          : status === 'listening'  ? t('phrases.listening')
          : status === 'processing' ? t('phrases.analyzing')
          : status === 'done'       ? t('phrases.tapAgain')
          : errorMsg}
      </p>

      {/* AI 기능 설명 — 마이크 버튼/상태 문구와 예시 결과 카드 사이에 가볍게 표시 */}
      <div className="mt-3 flex max-w-xs items-start justify-center gap-1.5 text-center text-xs text-ink-faint">
        <AiSparklesIcon size={17} className="shrink-0 text-coral" />
        <p>{t('phrases.voiceAiDescription')}</p>
      </div>

      {/* Result card — shown in idle (example) and done (analysis result) */}
      {showCard && (
        <div className="mt-8 w-full rounded-2xl border border-ink/8 bg-white px-4 py-4 text-sm">
          <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
            {isDone ? t('phrases.analysisResult') : t('phrases.exampleResult')}
          </p>

          <p className="text-[0.7rem] font-bold uppercase tracking-widest text-ink-faint">
            {t('phrases.originalPhrase')}
          </p>
          <p className="mt-1 text-base font-bold text-ink">
            {displayOriginal}
          </p>

          <div className="my-3 border-t border-ink/8" />

          <p className="text-[0.7rem] font-bold uppercase tracking-widest text-ink-faint">
            {t('phrases.meaning')}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {displayMeaning}
          </p>

          <div className="my-3 border-t border-ink/8" />

          <p className="text-[0.7rem] font-bold uppercase tracking-widest text-ink-faint">
            {t('phrases.suggestedReply')}
          </p>
          <div className="mt-1 flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-ink">
                {displayReplyKo}
              </p>
              <p className="mt-0.5 text-xs italic text-ink-faint">
                {displayReplyRomanization}
              </p>
              {displayReplyMeaning && (
                <p className="mt-0.5 text-xs text-ink-faint">
                  {displayReplyMeaning}
                </p>
              )}
            </div>
            {isDone && (
              <button
                type="button"
                onClick={() => speakKorean(result.suggestedReplyKo)}
                aria-label="Listen to suggested reply"
                className="mt-0.5 shrink-0 text-coral"
              >
                <SpeakerIcon size={20} />
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
