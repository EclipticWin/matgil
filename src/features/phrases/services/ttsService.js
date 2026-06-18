/** Web Speech API wrapper — isolated so pages don't touch the browser API directly. */

let currentUtterance = null;

export function isTTSSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Find the best available Korean voice using a ranked priority list. */
function getKoreanVoice() {
  const voices = window.speechSynthesis.getVoices();

  // 1순위: Google 한국어 (ko-KR, name에 Google + 한국어 모두 포함)
  const p1 = voices.find(
    (v) => v.lang === 'ko-KR' && v.name.includes('Google') && v.name.includes('한국어'),
  );
  if (p1) return p1;

  // 2순위: ko-KR이면서 Google
  const p2 = voices.find((v) => v.lang === 'ko-KR' && v.name.includes('Google'));
  if (p2) return p2;

  // 3순위: ko-KR이면서 한국어
  const p3 = voices.find((v) => v.lang === 'ko-KR' && v.name.includes('한국어'));
  if (p3) return p3;

  // 4순위: ko-KR 아무거나
  const p4 = voices.find((v) => v.lang === 'ko-KR');
  if (p4) return p4;

  // 5순위: lang이 ko로 시작하는 아무거나
  return voices.find((v) => v.lang?.toLowerCase().startsWith('ko')) ?? null;
}

/** Speak Korean text aloud. No-op if the browser lacks speech synthesis. */
export function speakKorean(text) {
  console.log('[TTS DEBUG] speakKorean called:', text);

  if (!isTTSSupported()) {
    console.log('[TTS DEBUG] Web Speech API not supported');
    return;
  }

  try {
    const synth = window.speechSynthesis;

    // Only cancel if something is already in progress — avoids Chrome idle-cancel bug
    if (synth.speaking || synth.pending) {
      synth.cancel();
    }

    currentUtterance = new SpeechSynthesisUtterance(text);

    const koVoice = getKoreanVoice();
    if (koVoice) {
      console.log('[TTS DEBUG] selected voice:', koVoice.name, koVoice.lang);
      currentUtterance.voice = koVoice;
    } else {
      console.log('[TTS DEBUG] no Korean voice found — falling back to lang=ko-KR');
      currentUtterance.lang = 'ko-KR';
    }
    currentUtterance.lang   = 'ko-KR';
    currentUtterance.rate   = 0.9;
    currentUtterance.volume = 1;
    currentUtterance.pitch  = 1;

    currentUtterance.onstart = () => console.log('[TTS DEBUG] started');
    currentUtterance.onend   = () => console.log('[TTS DEBUG] ended');
    currentUtterance.onerror = (e) => console.log('[TTS DEBUG] error:', e.error);

    // Short delay lets the browser fully process a preceding cancel() before speak()
    setTimeout(() => {
      synth.speak(currentUtterance);
    }, 50);
  } catch (err) {
    console.log('[TTS DEBUG] exception:', err);
  }
}

export function stopSpeaking() {
  if (isTTSSupported()) window.speechSynthesis.cancel();
}
