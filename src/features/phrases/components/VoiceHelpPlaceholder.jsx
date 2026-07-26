import { useEffect, useState } from 'react';
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

// Which speech-recognition languages a UI locale can pick from, and the
// default picked when the locale first loads or changes (see the effect
// below). ko-only locale never shows the picker at all (§ task 2 — "한국어
// UI에서는 별도의 두 언어 선택 기능을 만들지 않는다"), it's just always ko-KR.
const SPEECH_LANGUAGE_OPTIONS = {
  ko: [{ code: 'ko-KR', labelKey: 'phrases.speakKorean' }],
  en: [
    { code: 'en-US', labelKey: 'phrases.speakEnglish' },
    { code: 'ko-KR', labelKey: 'phrases.speakKorean' },
  ],
  'zh-CN': [
    { code: 'zh-CN', labelKey: 'phrases.speakChinese' },
    { code: 'ko-KR', labelKey: 'phrases.speakKorean' },
  ],
};
const DEFAULT_SPEECH_LANGUAGE = { ko: 'ko-KR', en: 'en-US', 'zh-CN': 'zh-CN' };

// Static example shown before the mic has ever been used — never calls the
// LLM. Keyed by [uiLocale][speechLanguage] and shaped exactly like a real
// analysis result (see AnalyzeResult in supabase/functions/mg-voice-help),
// so the idle example and a real result render through the same JSX below.
// suggestedReplyMeaning is omitted for the ko/ko-KR case — a ko-locale user
// already reads the Korean reply directly, so that gloss line is suppressed
// for locale 'ko' regardless (see displayReplyMeaning below).
const EXAMPLES = {
  ko: {
    'ko-KR': {
      originalPhrase: '선불입니다.',
      meaning: '식사 전에 먼저 결제해야 한다는 뜻입니다.',
      suggestedReply: '알겠어요.',
      suggestedReplyLanguage: 'ko',
      suggestedReplyPronunciation: 'Algeseoyo.',
      suggestedReplyMeaning: '',
    },
  },
  en: {
    'en-US': {
      originalPhrase: 'Hello',
      meaning: '안녕하세요.',
      suggestedReply: '안녕하세요.',
      suggestedReplyLanguage: 'ko',
      suggestedReplyPronunciation: 'Annyeonghaseyo.',
      suggestedReplyMeaning: 'Hello.',
    },
    'ko-KR': {
      originalPhrase: '선불입니다.',
      meaning: 'You need to pay before eating.',
      suggestedReply: 'Okay, I understand.',
      suggestedReplyLanguage: 'en',
      suggestedReplyPronunciation: '',
      suggestedReplyMeaning: '알겠습니다.',
    },
  },
  'zh-CN': {
    'zh-CN': {
      originalPhrase: '你好',
      meaning: '안녕하세요.',
      suggestedReply: '안녕하세요.',
      suggestedReplyLanguage: 'ko',
      suggestedReplyPronunciation: 'Annyeonghaseyo.',
      suggestedReplyMeaning: '你好。',
    },
    'ko-KR': {
      originalPhrase: '선불입니다.',
      meaning: '需要先付款。',
      suggestedReply: '好的，我知道了。',
      suggestedReplyLanguage: 'zh-CN',
      suggestedReplyPronunciation: '',
      suggestedReplyMeaning: '알겠습니다.',
    },
  },
};

export default function VoiceHelpPlaceholder() {
  const { locale, t } = useLocale();
  const [status, setStatus] = useState('idle');
  // idle | listening | processing | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [speechLanguage, setSpeechLanguage] = useState(() => DEFAULT_SPEECH_LANGUAGE[locale] ?? 'ko-KR');

  // Reset to the locale's own default speech language whenever the UI locale
  // changes — a speech-language choice made under one locale (e.g. "ko-KR"
  // picked while in English mode) has no meaning after switching to Chinese.
  useEffect(() => {
    setSpeechLanguage(DEFAULT_SPEECH_LANGUAGE[locale] ?? 'ko-KR');
  }, [locale]);

  const speechSupported = isSpeechRecognitionSupported();
  const isListening = status === 'listening';
  const isProcessing = status === 'processing';
  const isDone = status === 'done';
  const showCard = status === 'idle' || isDone;
  const micDisabled = !speechSupported || isProcessing;
  const speechLanguageOptions = SPEECH_LANGUAGE_OPTIONS[locale] ?? SPEECH_LANGUAGE_OPTIONS.ko;
  const showSpeechLanguagePicker = locale !== 'ko';
  const speechLanguagePickerDisabled = isListening || isProcessing;

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
      language: speechLanguage,
      onResult: async (transcript) => {
        setStatus('processing');
        try {
          const { data, error } = await supabase.functions.invoke('mg-voice-help', {
            body: {
              transcript,
              userLanguage: locale,
              sourceLanguage: speechLanguage,
              context: 'Korean restaurant',
            },
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

  // Real analysis result (isDone) vs. the static example (EXAMPLES) — both are
  // the same shape, so the rest of the render logic doesn't need to branch
  // per-field.
  const display = isDone ? result : (EXAMPLES[locale]?.[speechLanguage] ?? EXAMPLES.ko['ko-KR']);
  const displayReplyIsKorean = display.suggestedReplyLanguage === 'ko';
  // ko-locale users already read a Korean reply directly, so its gloss is
  // only shown for non-ko locales (same convention as before this change).
  const displayReplyMeaning = locale === 'ko' ? null : (display.suggestedReplyMeaning || null);

  return (
    <div className="flex flex-col items-center px-4 pt-12 pb-8">

      {/* Speech language picker — only for locales with a real choice (en/zh-CN);
          ko stays fixed to ko-KR with no picker at all. */}
      {showSpeechLanguagePicker && (
        <div className="mb-4 flex flex-col items-center gap-1.5">
          <p className="text-xs font-semibold text-ink-faint">{t('phrases.speakingLanguage')}</p>
          <div className="flex gap-2">
            {speechLanguageOptions.map((opt) => (
              <button
                key={opt.code}
                type="button"
                disabled={speechLanguagePickerDisabled}
                onClick={() => setSpeechLanguage(opt.code)}
                className={cn(
                  'h-8 rounded-full px-3.5 text-[0.8125rem] font-bold transition-colors',
                  speechLanguage === opt.code ? 'bg-coral text-white' : 'bg-white text-ink-soft shadow-soft',
                  speechLanguagePickerDisabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

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
      <div className="mt-3 flex max-w-xs items-start justify-center gap-1 text-center text-xs text-ink-faint">
        <AiSparklesIcon size={34} className="shrink-0 text-coral" />
        <p className="text-left">{t('phrases.voiceAiDescription')}</p>
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
            {display.originalPhrase}
          </p>

          <div className="my-3 border-t border-ink/8" />

          <p className="text-[0.7rem] font-bold uppercase tracking-widest text-ink-faint">
            {t('phrases.meaning')}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {display.meaning}
          </p>

          <div className="my-3 border-t border-ink/8" />

          <p className="text-[0.7rem] font-bold uppercase tracking-widest text-ink-faint">
            {t('phrases.suggestedReply')}
          </p>
          <div className="mt-1 flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-ink">
                {display.suggestedReply}
              </p>
              {display.suggestedReplyPronunciation && (
                <p className="mt-0.5 text-xs italic text-ink-faint">
                  {display.suggestedReplyPronunciation}
                </p>
              )}
              {displayReplyMeaning && (
                <p className="mt-0.5 text-xs text-ink-faint">
                  {displayReplyMeaning}
                </p>
              )}
            </div>
            {/* Korean TTS only understands Korean text — showing it for an
                English/Chinese suggested reply would silently mis-speak it,
                so the button only ever appears for a Korean suggested reply. */}
            {isDone && displayReplyIsKorean && (
              <button
                type="button"
                onClick={() => speakKorean(result.suggestedReply)}
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
