import { useState } from 'react';
import { MicIcon, SpeakerIcon } from '../../../shared/components/Icon.jsx';
import { speakKorean } from '../services/ttsService.js';
import { supabase } from '../../../lib/supabase.js';
import {
  isSpeechRecognitionSupported,
  startListening,
  stopListening,
} from '../services/speechRecognitionService.js';
import { cn } from '../../../shared/utils/classNames.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

export default function VoiceHelpPlaceholder() {
  const { t } = useLocale();
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
            body: { transcript, userLanguage: 'en', context: 'Korean restaurant' },
          });
          if (error) throw error;
          setResult(data);
          setStatus('done');
        } catch {
          setErrorMsg('Could not analyze. Please try again.');
          setStatus('error');
        }
      },
      onError: (code) => {
        if (code === 'aborted') return;
        const msg =
          code === 'not-allowed'
            ? 'Voice access denied.'
            : 'Could not understand. Please try again.';
        setErrorMsg(msg);
        setStatus('error');
      },
    });
  }

  const isListening = status === 'listening';
  const isProcessing = status === 'processing';
  const showCard = status === 'idle' || status === 'done';
  const micDisabled = !speechSupported || isProcessing;

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

      {/* Result card — shown in idle (example) and done (analysis result) */}
      {showCard && (
        <div className="mt-8 w-full rounded-2xl border border-ink/8 bg-white px-4 py-4 text-sm">
          <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
            {status === 'done' ? t('phrases.analysisResult') : t('phrases.exampleResult')}
          </p>

          <p className="text-[0.7rem] font-bold uppercase tracking-widest text-ink-faint">
            {t('phrases.originalPhrase')}
          </p>
          <p className="mt-1 text-base font-bold text-ink">
            {status === 'done' ? result.originalPhrase : '선불입니다.'}
          </p>

          <div className="my-3 border-t border-ink/8" />

          <p className="text-[0.7rem] font-bold uppercase tracking-widest text-ink-faint">
            {t('phrases.meaning')}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {status === 'done' ? result.meaning : 'You need to pay before eating.'}
          </p>

          <div className="my-3 border-t border-ink/8" />

          <p className="text-[0.7rem] font-bold uppercase tracking-widest text-ink-faint">
            {t('phrases.suggestedReply')}
          </p>
          <div className="mt-1 flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-ink">
                {status === 'done' ? result.suggestedReplyKo : '알겠어요.'}
              </p>
              <p className="mt-0.5 text-xs italic text-ink-faint">
                {status === 'done' ? result.suggestedReplyRomanization : 'Algeseoyo.'}
              </p>
            </div>
            {status === 'done' && (
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
