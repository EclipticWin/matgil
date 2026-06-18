import { MicIcon } from '../../../shared/components/Icon.jsx';

/** Voice help tab — placeholder UI only. Real speech recognition is not yet implemented. */
export default function VoiceHelpPlaceholder() {
  return (
    <div className="flex flex-col items-center px-4 pt-12 pb-8">

      {/* Mic button */}
      <div className="relative">
        <button
          type="button"
          disabled
          aria-label="Record speech (coming soon)"
          className="flex h-40 w-40 items-center justify-center rounded-full bg-coral text-white"
        >
          <MicIcon size={60} />
        </button>
        <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-ink-soft">
          Coming soon
        </span>
      </div>

      <p className="mt-8 text-sm font-semibold text-ink-soft">Tap and speak.</p>

      {/* Result card */}
      <div className="mt-8 w-full rounded-2xl border border-ink/8 bg-white px-4 py-4 text-sm">
        <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">Example result</p>

        <p className="text-[0.7rem] font-bold uppercase tracking-widest text-ink-faint">Korean phrase</p>
        <p className="mt-1 text-base font-bold text-ink">선불입니다.</p>

        <div className="my-3 border-t border-ink/8" />

        <p className="text-[0.7rem] font-bold uppercase tracking-widest text-ink-faint">Meaning</p>
        <p className="mt-1 text-sm text-ink-soft">You need to pay before eating.</p>

        <div className="my-3 border-t border-ink/8" />

        <p className="text-[0.7rem] font-bold uppercase tracking-widest text-ink-faint">Suggested reply</p>
        <p className="mt-1 font-bold text-ink">알겠어요.</p>
        <p className="mt-0.5 text-xs italic text-ink-faint">Algeseoyo.</p>
      </div>

    </div>
  );
}
