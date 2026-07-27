const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

export function isSpeechRecognitionSupported() {
  return !!SpeechRecognitionAPI;
}

// Dev-only, best-effort — Vite statically replaces import.meta.env.DEV with
// a literal `false` in production builds, so every devLog() call below is
// dead code there (stripped, not just silenced). Never logs transcript
// content beyond its length — see devLog call sites below.
function devLog(...args) {
  if (import.meta.env.DEV) console.log('[voice]', ...args);
}

// The one in-flight session, if any. An object (not the bare recognition
// instance) so a session can carry its own `settled`/`manuallyAborted` flags
// — closed over by that session's own event handlers, so a late/stale event
// from a session that's already been replaced or already stopped can never
// reach a NEWER session's onResult/onError (see startListening/stopListening).
let activeSession = null;

/** Reads a session's own text out of a SpeechRecognitionEvent, starting at
 *  event.resultIndex (not just results[0]) — continuous/interimResults are
 *  both false below, so in practice this almost always sees exactly one
 *  final result, but this doesn't assume that's the only shape a browser
 *  can produce. A later final result wins over an earlier non-final one;
 *  otherwise the first non-empty alternative found is used. */
function collectTranscript(event) {
  const results = event?.results;
  if (!results || results.length === 0) return '';
  const start = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;

  let finalText = '';
  let anyText = '';
  for (let i = start; i < results.length; i++) {
    const result = results[i];
    const alt = result && result[0];
    const text = alt?.transcript ?? '';
    if (!text) continue;
    if (!anyText) anyText = text;
    if (result.isFinal) finalText = text;
  }
  return (finalText || anyText).trim();
}

/** Start listening. Calls onResult(transcript) on success, onError(code) on
 *  failure — exactly one of the two, exactly once per call, no matter how
 *  the underlying recognition session actually ends.
 *
 *  `language` is a BCP-47 speech-recognition code (e.g. 'ko-KR', 'en-US',
 *  'zh-CN') — without it the browser guesses the page/system language,
 *  which is what let Chinese speech ("你好") get transcribed as Korean
 *  romanization ("니하오") in a ko-locale session. Defaults to 'ko-KR' only
 *  so an old call site that hasn't been updated to pass `language` still
 *  behaves as before, not because ko-KR is a good guess for every caller —
 *  every current caller (VoiceHelpPlaceholder) passes it explicitly.
 *
 *  Session lifecycle (the actual fix this rewrite is for): some mobile
 *  browsers stop a recognition session with ONLY an `end` event — no
 *  `result`, no `error` — when nothing usable was captured (e.g. silence,
 *  a very short/quiet utterance). The previous version of this function
 *  treated `onend` as pure cleanup and called neither onResult nor onError
 *  in that case, so the caller's UI state (e.g. "listening") never
 *  transitioned and stayed stuck until the user acted again. Every exit
 *  path below now funnels through settleResult()/settleError(), each
 *  guarded by `session.settled` so at most one of onResult/onError ever
 *  fires for a given startListening() call — and onend specifically calls
 *  settleError('no-speech') when it fires before anything else settled the
 *  session (see its handler below). */
export function startListening({ language, onResult, onError }) {
  // Any previous session that's still technically "active" (its own onend/
  // onerror hasn't fired yet) is stopped first. Its manuallyAborted flag is
  // set here, so whatever late event it still produces settles quietly
  // (see onerror/onend below) instead of ever reaching ITS onResult/onError
  // — which by now belong to a call the UI has already moved on from.
  stopListening();

  if (!SpeechRecognitionAPI) {
    onError('not_supported');
    return;
  }

  const recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = language || 'ko-KR';

  const session = { recognition, manuallyAborted: false, settled: false };
  activeSession = session;

  function releaseSession() {
    if (activeSession === session) activeSession = null;
  }

  function settleResult(transcript) {
    if (session.settled) return;
    session.settled = true;
    devLog('result', transcript.length, 'chars');
    releaseSession();
    onResult(transcript);
  }

  function settleError(code) {
    if (session.settled) return;
    session.settled = true;
    devLog('error', code);
    releaseSession();
    onError(code);
  }

  recognition.onstart = () => devLog('start', recognition.lang);

  recognition.onresult = (event) => {
    const transcript = collectTranscript(event);
    if (transcript) settleResult(transcript);
    else settleError('no-speech');
  };

  // Recognition completed but matched nothing with usable confidence —
  // same "no result" outcome as an empty onresult, just a different event.
  recognition.onnomatch = () => settleError('no-speech');

  recognition.onerror = (event) => {
    // 'aborted' from our OWN stopListening() call is expected, not a failure
    // — session cleanup (and, if nothing settled yet, the no-result fallback)
    // happens in onend right after this, with no error surfaced to the caller.
    if (event.error === 'aborted' && session.manuallyAborted) return;
    settleError(event.error);
  };

  recognition.onend = () => {
    devLog('end', 'settled=', session.settled, 'manuallyAborted=', session.manuallyAborted);
    if (!session.settled) {
      // Ended with neither a result nor an error — the core mobile-browser
      // case this rewrite fixes. A manual stop is the one ending that
      // should stay silent (no onError); anything else (including an
      // unexpected/browser-initiated abort that never reached onerror as
      // 'aborted') is reported as a no-result failure so the UI can leave
      // "listening" and let the user try again.
      if (session.manuallyAborted) {
        session.settled = true;
      } else {
        settleError('no-speech');
      }
    }
    releaseSession();
  };

  devLog('starting', recognition.lang);
  try {
    recognition.start();
  } catch (err) {
    devLog('start-failed', err);
    releaseSession();
    settleError('start-failed');
  }
}

/** Ends the current session, if any, without firing onResult/onError for it.
 *  Idempotent — safe to call when nothing is listening, and safe to call
 *  more than once for the same session (its own onerror/onend guard against
 *  double-settling regardless). Marks the session as user-initiated BEFORE
 *  aborting, so the 'aborted' error/end this triggers is recognized as
 *  expected rather than surfaced as a failure. */
export function stopListening() {
  const session = activeSession;
  if (!session) return;
  session.manuallyAborted = true;
  try {
    session.recognition.abort();
  } catch {
    // abort() itself throwing isn't actionable here — the session is being
    // torn down either way, and its own onerror/onend (if they still fire)
    // will see manuallyAborted and settle quietly.
  }
}
