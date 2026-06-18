/** Web Speech API wrapper — isolated so pages don't touch the browser API directly. */

let currentUtterance = null;

// undefined = not yet searched; null = searched but no Korean voice found; Voice = cached
let koreanVoice = undefined;

export function isTTSSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Find the best available Korean voice using a ranked priority list. */
function findBestKoreanVoice(voices) {
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

// Pre-warm voice cache as soon as the browser makes voices available.
// Chrome fires voiceschanged asynchronously; Firefox/Safari may have voices synchronously.
if (isTTSSupported()) {
  const synth = window.speechSynthesis;

  const cacheVoice = () => {
    const voices = synth.getVoices();
    if (voices.length > 0 && koreanVoice === undefined) {
      koreanVoice = findBestKoreanVoice(voices);
      console.log('[TTS DEBUG] voices pre-loaded:', koreanVoice?.name ?? 'none found');
    }
  };

  synth.addEventListener('voiceschanged', cacheVoice);
  cacheVoice(); // Immediate attempt for Firefox/Safari
}

function doSpeak(synth, text, voice) {
  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.lang   = 'ko-KR';
  currentUtterance.rate   = 0.9;
  currentUtterance.volume = 1;
  currentUtterance.pitch  = 1;

  if (voice) {
    console.log('[TTS DEBUG] selected voice:', voice.name, voice.lang);
    currentUtterance.voice = voice;
  } else {
    console.log('[TTS DEBUG] no Korean voice found — falling back to lang=ko-KR');
  }

  currentUtterance.onstart = () => console.log('[TTS DEBUG] started');
  currentUtterance.onend   = () => console.log('[TTS DEBUG] ended');
  currentUtterance.onerror = (e) => console.log('[TTS DEBUG] error:', e.error);

  synth.speak(currentUtterance);
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
    const wasSpeaking = synth.speaking || synth.pending;

    if (wasSpeaking) {
      synth.cancel();
    }

    // Voices not loaded yet (Chrome: first call before voiceschanged fires)
    if (koreanVoice === undefined && synth.getVoices().length === 0) {
      console.log('[TTS DEBUG] voices not yet loaded — queuing until voiceschanged');
      const handler = () => {
        synth.removeEventListener('voiceschanged', handler);
        koreanVoice = findBestKoreanVoice(synth.getVoices());
        // wasSpeaking was false (nothing was playing), so no cancel delay needed
        doSpeak(synth, text, koreanVoice);
      };
      synth.addEventListener('voiceschanged', handler);
      return;
    }

    // Voices available — resolve cache if not yet done
    if (koreanVoice === undefined) {
      koreanVoice = findBestKoreanVoice(synth.getVoices());
    }

    if (wasSpeaking) {
      // Delay only when cancel() was called — avoids Chrome cancel-then-speak bug
      setTimeout(() => doSpeak(synth, text, koreanVoice), 50);
    } else {
      doSpeak(synth, text, koreanVoice);
    }
  } catch (err) {
    console.log('[TTS DEBUG] exception:', err);
  }
}

export function stopSpeaking() {
  if (isTTSSupported()) window.speechSynthesis.cancel();
}
