import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';

const DEBOUNCE_MS = 500;

/** Debounced nickname-availability check against the is_nickname_available() RPC.
 *  This is UX-only — the final, authoritative check is set_my_nickname's DB unique
 *  constraint at save time. Returns 'idle' | 'checking' | 'available' | 'taken'.
 *  'idle' whenever the trimmed value is too short to check, or matches
 *  `excludeCurrent` exactly (skips the round trip when unchanged). */
export function useNicknameAvailability(rawValue, { excludeCurrent } = {}) {
  const [status, setStatus] = useState('idle');
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = rawValue.trim();
    if (trimmed.length < 2 || trimmed === excludeCurrent) {
      setStatus('idle');
      return;
    }

    setStatus('checking');
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      supabase.rpc('is_nickname_available', { p_nickname: trimmed })
        .then(({ data, error }) => {
          if (requestIdRef.current !== requestId) return;
          setStatus(error ? 'idle' : data ? 'available' : 'taken');
        })
        .catch(() => {
          if (requestIdRef.current === requestId) setStatus('idle');
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [rawValue, excludeCurrent]);

  return status;
}
