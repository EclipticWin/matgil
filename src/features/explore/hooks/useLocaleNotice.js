import { useCallback, useRef, useState } from 'react';
import { getActiveLocaleNotice } from '../../../api/localeNoticeApi.js';

/** DB-driven locale notice (mg_locale_notices), shared by every LanguageModal
 *  call site (HomePage, MyPage, ...). Owns only the fetch and its resulting
 *  `notice` state — the page still owns its own language-picker sheet/modal
 *  open state and is expected to close that itself before calling
 *  `handleLanguageSelected`, keeping this hook decoupled from any one page's
 *  layout.
 *
 *  `requestSeqRef` guards against a slower earlier request (e.g. zh-CN)
 *  resolving after a faster later one (e.g. en) and clobbering it — only the
 *  response matching the most recently issued sequence number is applied. */
export function useLocaleNotice(noticeKey = 'search_data_notice') {
  const [notice, setNotice] = useState(null);
  const requestSeqRef = useRef(0);

  const handleLanguageSelected = useCallback(async (locale) => {
    const seq = ++requestSeqRef.current;
    try {
      const result = await getActiveLocaleNotice(locale, noticeKey);
      if (requestSeqRef.current === seq) setNotice(result);
    } catch (error) {
      console.warn('[useLocaleNotice] failed to load locale notice', error);
      if (requestSeqRef.current === seq) setNotice(null);
    }
  }, [noticeKey]);

  const closeNotice = useCallback(() => setNotice(null), []);

  return { notice, handleLanguageSelected, closeNotice };
}
