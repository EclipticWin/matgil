const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

export function isSpeechRecognitionSupported() {
  return !!SpeechRecognitionAPI;
}

let activeRecognition = null;

/** Start listening. Calls onResult(transcript) on success, onError(code) on failure. */
export function startListening({ onResult, onError }) {
  if (!SpeechRecognitionAPI) {
    onError('not_supported');
    return;
  }

  const recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = false;
  // No lang set — accepts Korean and English input

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
