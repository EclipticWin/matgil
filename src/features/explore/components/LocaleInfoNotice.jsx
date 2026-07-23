import { CloseIcon } from '../../../shared/components/Icon.jsx';

/** Presentational only — title/message come entirely from the caller (a row
 *  from `mg_locale_notices` via getActiveLocaleNotice), so this component
 *  knows nothing about any specific locale and is reused as more locale
 *  notices are added. `whitespace-pre-line` renders the DB message's `\n`
 *  line breaks without splitting it into an array. */
export default function LocaleInfoNotice({ title, message, onClose }) {
  return (
    <>
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-1.5 pt-5">
        <h2 className="font-display text-[1.15rem] font-bold tracking-tight text-ink">
          {title}
        </h2>
        <button type="button" aria-label="Close" onClick={onClose} className="shrink-0 p-1 text-ink-soft">
          <CloseIcon />
        </button>
      </div>
      <div className="px-5 pb-6 pt-1">
        <p className="whitespace-pre-line text-[0.85rem] leading-relaxed text-ink-soft">{message}</p>
      </div>
    </>
  );
}
