import Modal from './Modal.jsx';
import { CloseIcon } from '../../../shared/components/Icon.jsx';
import { useEscapeToClose } from '../../../shared/hooks/useEscapeToClose.js';

const TITLE = '日本語サービス準備中';
const MESSAGE = '日本語サービスは現在準備中です。ご利用いただけるまで、もうしばらくお待ちください。';
const CONFIRM = '確認';

/** Fixed front-end notice shown when a user picks 日本語 from the language
 *  picker (see LanguageModal's COMING_SOON_LANGUAGES). Unlike LocaleInfoNotice
 *  — which is DB-driven (mg_locale_notices) and only ever follows an actual
 *  locale switch — this copy is hardcoded and never touches locale state:
 *  Japanese isn't a supported locale yet, this is only an entry point
 *  announcing it's coming. Reuses the shared Modal shell only. */
export default function JapaneseComingSoonModal({ open, onClose }) {
  useEscapeToClose(open, onClose);

  return (
    <Modal open={open} onClose={onClose} variant="center" dismissOnBackdrop>
      <div role="dialog" aria-modal="true" aria-labelledby="ja-coming-soon-title" className="contents">
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-1.5 pt-5">
          <h2 id="ja-coming-soon-title" className="font-display text-[1.15rem] font-bold tracking-tight text-ink">
            {TITLE}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="shrink-0 p-1 text-ink-soft">
            <CloseIcon />
          </button>
        </div>
        <div className="px-5 pb-5 pt-1">
          <p className="whitespace-pre-line text-[0.85rem] leading-relaxed text-ink-soft">{MESSAGE}</p>
        </div>
        <div className="px-5 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-coral py-3 text-sm font-bold text-white"
          >
            {CONFIRM}
          </button>
        </div>
      </div>
    </Modal>
  );
}
