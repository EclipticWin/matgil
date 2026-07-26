const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

export function isSpeechRecognitionSupported() {
  return !!SpeechRecognitionAPI;
}

let activeRecognition = null;

/** Start listening. Calls onResult(transcript) on success, onError(code) on failure.
 *  `language` is a BCP-47 speech-recognition code (e.g. 'ko-KR', 'en-US', 'zh-CN') —
 *  without it the browser guesses the page/system language, which is what let
 *  Chinese speech ("你好") get transcribed as Korean romanization ("니하오") in a
 *  ko-locale session. Defaults to 'ko-KR' only so an old call site that hasn't
 *  been updated to pass `language` still behaves as before, not because ko-KR
 *  is a good guess for every caller — every current caller (VoiceHelpPlaceholder)
 *  passes it explicitly. */
export function startListening({ language, onResult, onError }) {
  if (!SpeechRecognitionAPI) {
    onError('not_supported');
    return;
  }

  const recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = language || 'ko-KR';

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript ?? '';
    activeRecognition = null;
    if (transcript.trim()) {
      onResult(transcript.trim());
    } else {
      onError('no_speech');
    }
  };

  recognition.onerror = (event) => {
    activeRecognition = null;
    onError(event.error);
  };

  recognition.onend = () => {
    activeRecognition = null;
  };

  activeRecognition = recognition;
  recognition.start();
}

/** Abort the current recognition session without firing onResult. */
export function stopListening() {
  if (activeRecognition) {
    activeRecognition.abort();
    activeRecognition = null;
  }
}
