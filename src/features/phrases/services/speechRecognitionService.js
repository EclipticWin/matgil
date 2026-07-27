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
// instance) so a session can carry its own `finishRequested`/`manuallyAborted`/
// `settled` flags — closed over by that session's own event handlers, so a
// late/stale event from a session that's already been replaced or already
// finished can never reach a NEWER session's onResult/onError (see
// startListening/finishListening/cancelListening).
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
 *  Session lifecycle: some mobile browsers stop a recognition session with
 *  ONLY an `end` event — no `result`, no `error` — when nothing usable was
 *  captured (e.g. silence, a very short/quiet utterance). Every exit path
 *  below funnels through settleResult()/settleError(), each guarded by
 *  `session.settled` so at most one of onResult/onError ever fires for a
 *  given startListening() call — and onend specifically calls
 *  settleError('no-speech') when it fires before anything else settled the
 *  session AND the session wasn't cancelled (see onend below).
 *
 *  Ending a session comes in two flavors, and they are NOT interchangeable:
 *  - finishListening() → recognition.stop() → asks the browser to finalize
 *    whatever was captured so far; a normal onresult still follows.
 *  - cancelListening() → recognition.abort() → discards everything captured;
 *    onResult/onError never fire for that session.
 *  A second mic-button tap while listening must finish, not cancel — see
 *  finishListening's own doc comment for why. */
export function startListening({ language, onResult, onError }) {
  // A brand-new recording request supersedes whatever came before — cancel
  // (discard, don't wait on) any still-active previous session. This is a
  // cancel, not a finish: nobody is waiting on that old session's transcript
  // anymore, so there's nothing to preserve it for.
  cancelListening();

  if (!SpeechRecognitionAPI) {
    onError('not_supported');
    return;
  }

  const recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = language || 'ko-KR';

  const session = { recognition, manuallyAborted: false, finishRequested: false, settled: false };
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
    // 'aborted' from our OWN cancelListening() call is expected, not a
    // failure — cancelListening() always targets a session that's being
    // replaced or torn down, never one a caller is still waiting on for a
    // real result. A user-requested finish (finishListening) never sets
    // manuallyAborted, so it always falls through to settleError below.
    if (event.error === 'aborted' && session.manuallyAborted) return;
    settleError(event.error);
  };

  recognition.onend = () => {
    devLog(
      'end',
      'settled=', session.settled,
      'manuallyAborted=', session.manuallyAborted,
      'finishRequested=', session.finishRequested,
    );
    if (!session.settled) {
      // A manual cancel is the one ending that should stay silent (no
      // onError) — genuinely nothing to report. Everything else, including
      // a manual finish() that captured nothing (finishRequested but no
      // result arrived) or an unexpected end with no result/error at all,
      // is reported as a no-result failure — same as an auto end-of-speech
      // on silence — so the UI can leave "listening"/"finishing" and let
      // the user try again.
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

/** User-requested finish — e.g. a second mic-button tap while listening.
 *  Calls recognition.stop(), which asks the browser to stop capturing and
 *  finalize whatever was heard SO FAR, rather than discarding it: a normal
 *  onresult still follows in the usual case, arriving through the exact
 *  same settleResult() path as an automatic end-of-speech. If nothing usable
 *  was captured before stop() was called, onend alone resolves it via the
 *  same no-speech fallback used for a silent auto end-of-speech (see
 *  startListening's onend above) — finishRequested does not suppress that.
 *
 *  Idempotent: a second call while a finish is already pending, or a call
 *  with no active/already-settled session, does nothing. This is the one
 *  function a normal "I'm done talking" UI action should ever call — for
 *  discarding a session instead, see cancelListening(). */
export function finishListening() {
  const session = activeSession;
  if (!session || session.settled || session.finishRequested) return;
  session.finishRequested = true;
  devLog('finish requested');
  try {
    session.recognition.stop();
  } catch {
    // stop() itself throwing isn't actionable here — the session's own
    // onerror/onend (if they still fire) settle it regardless.
  }
}

/** Cancels the current session, if any, WITHOUT firing onResult/onError for
 *  it — whatever was heard so far is discarded, not finalized. Idempotent —
 *  safe to call when nothing is listening, and safe to call more than once
 *  for the same session (its own onerror/onend guard against double-settling
 *  regardless). Marks the session as manually-aborted BEFORE aborting, so the
 *  'aborted' error/end this triggers is recognized as expected rather than
 *  surfaced as a failure.
 *
 *  Reserved for internal/cleanup use — replacing a still-active session with
 *  a new one (see startListening above) or tearing one down early (e.g. on
 *  component unmount). NEVER call this for an ordinary user-requested
 *  "I'm done talking" action; use finishListening() for that instead, since
 *  abort() would silently throw away the transcript the user just spoke. */
export function cancelListening() {
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
