import { useEffect, useState } from 'react';
import { MicIcon, SpeakerIcon, AiSparklesIcon } from '../../../shared/components/Icon.jsx';
import { speakKorean } from '../services/ttsService.js';
import { supabase } from '../../../lib/supabase.js';
import {
  isSpeechRecognitionSupported,
  startListening,
  finishListening,
  cancelListening,
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

// Web Speech API codes this screen treats as "microphone access denied"
// (phrases.voiceDenied). Every other code — no-speech/no_speech/nomatch,
// audio-capture, network, language-not-supported, start-failed, not_supported,
// or anything unrecognized — shares the same generic phrases.voiceError copy.
// 'aborted' isn't in either bucket: it's never a failure, see handleMicClick's
// onError below (speechRecognitionService.js only ever reports it for an
// internally-cancelled session — never for a normal user-requested finish,
// which calls stop() instead of abort() — so it's not something to show an
// error message for).
const VOICE_DENIED_ERROR_CODES = new Set(['not-allowed', 'service-not-allowed']);

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
  // idle | listening | finishing | processing | done | error
  //
  // 'finishing' covers the gap between a user-requested finish (second mic
  // tap while listening — see handleMicClick) and the transcript actually
  // arriving: recognition.stop() was called but onresult/onend hasn't fired
  // yet, so this is NOT the same moment as 'processing' (the Edge Function
  // call hasn't started — there's no transcript to send it yet). The status
  // text reuses phrases.analyzing's copy for both (see the status-text block
  // below) since "분석 중" reads fine to the user either way, but the two
  // are kept as distinct status values so the mic button can be disabled
  // through the whole finish→result gap without conflating it with an
  // actual in-flight Edge Function call.
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [speechLanguage, setSpeechLanguage] = useState(() => DEFAULT_SPEECH_LANGUAGE[locale] ?? 'ko-KR');

  // Reset to the locale's own default speech language whenever the UI locale
  // changes — a speech-language choice made under one locale (e.g. "ko-KR"
  // picked while in English mode) has no meaning after switching to Chinese.
  useEffect(() => {
    setSpeechLanguage(DEFAULT_SPEECH_LANGUAGE[locale] ?? 'ko-KR');
  }, [locale]);

  // Discard (never finalize) any still-listening session if this screen goes
  // away mid-recording — a real cancel, not a user-requested finish, so
  // cancelListening() (abort), not finishListening() (stop), is correct here.
  useEffect(() => {
    return () => cancelListening();
  }, []);

  const speechSupported = isSpeechRecognitionSupported();
  const isListening = status === 'listening';
  const isFinishing = status === 'finishing';
  const isProcessing = status === 'processing';
  const isDone = status === 'done';
  const showCard = status === 'idle' || isDone;
  const micDisabled = !speechSupported || isFinishing || isProcessing;
  const speechLanguageOptions = SPEECH_LANGUAGE_OPTIONS[locale] ?? SPEECH_LANGUAGE_OPTIONS.ko;
  const showSpeechLanguagePicker = locale !== 'ko';
  const speechLanguagePickerDisabled = isListening || isFinishing || isProcessing;

  function handleMicClick() {
    if (status === 'listening') {
      // Second tap while listening = "I'm done talking", not "cancel" —
      // finishListening() asks the recognizer to finalize what it has (via
      // stop()), it does not throw the transcript away (that's what the old
      // abort()-based stopListening() used to do, which is exactly why a
      // second tap used to make the transcript disappear). Stay off 'idle'
      // until the result (or a real no-speech failure) actually arrives.
      finishListening();
      setStatus('finishing');
      return;
    }

    if (status === 'processing' || status === 'finishing') return;

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
        if (code === 'aborted') {
          // A user-requested finish (second mic tap) now calls stop(), not
          // abort() — see finishListening() — so this only ever fires for a
          // session speechRecognitionService.js cancelled internally (e.g.
          // this screen unmounting mid-recording, or a new session replacing
          // a stale one) and couldn't otherwise attribute. Quietly back to
          // idle, never an error message.
          setErrorMsg('');
          setStatus('idle');
          return;
        }
        const msg = VOICE_DENIED_ERROR_CODES.has(code) ? t('phrases.voiceDenied') : t('phrases.voiceError');
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
        aria-label={isListening ? 'Finish speaking' : 'Record speech'}
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
          /* 'finishing' reuses the analyzing copy — the user-facing text is
             fine either way, even though no Edge Function call has started
             yet at this point (that only happens once onResult fires). */
          : status === 'finishing'  ? t('phrases.analyzing')
          : status === 'processing' ? t('phrases.analyzing')
          : status === 'done'       ? t('phrases.tapAgain')
          : errorMsg}
      </p>

      {/* 완료 방법 안내 — 상태 문구 바로 아래, AI 설명보다 작고 옅게 표시해
          AI 설명과 시각적으로 경쟁하지 않도록 함 */}
      <p className="mt-1.5 max-w-[15rem] text-center text-[0.7rem] leading-snug text-ink-faint">
        {t('phrases.speechFinishGuide')}
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
