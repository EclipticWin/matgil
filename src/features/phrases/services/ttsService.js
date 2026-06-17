/** Web Speech API wrapper, isolated so pages don't touch the browser API. */

export function isTTSSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Speak Korean text aloud. No-op if the browser lacks speech synthesis. */
export function speakKorean(text) {
  if (!isTTSSupported()) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* ignore */
  }
}

export function stopSpeaking() {
  if (isTTSSupported()) window.speechSynthesis.cancel();
}
