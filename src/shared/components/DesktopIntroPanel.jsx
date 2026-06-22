import matgilQr from '../../assets/desktop/matgil-qr.png';

function PinIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill="#F8481F"
      />
      <circle cx="12" cy="9" r="2.5" fill="white" />
    </svg>
  );
}

function RouteDecoration() {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="w-2.5 h-2.5 rounded-full bg-coral shrink-0" />
      <div className="flex gap-[5px] items-center">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="w-[6px] h-[3px] rounded-full bg-ink/20" />
        ))}
      </div>
      <div className="w-2.5 h-2.5 rounded-full bg-amber shrink-0" />
      <div className="flex gap-[5px] items-center">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="w-[6px] h-[3px] rounded-full bg-ink/20" />
        ))}
      </div>
      <div className="w-2.5 h-2.5 rounded-full bg-green shrink-0" />
    </div>
  );
}

export default function DesktopIntroPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-center w-[22.5rem] shrink-0 px-9 py-10">
      <div className="flex flex-col gap-5">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <PinIcon />
          <span className="font-display font-bold text-[1.25rem] tracking-tight text-ink">
            Matgil
          </span>
        </div>

        {/* Route decoration */}
        <RouteDecoration />

        {/* Headline */}
        <div className="font-display font-bold text-[2.75rem] leading-[1.1] tracking-tight">
          <span className="text-ink">Seoul </span>
          <span className="text-coral">Food</span>
          <br />
          <span className="text-coral">Routes </span>
          <span className="text-ink">for</span>
          <br />
          <span className="text-ink">Travelers</span>
        </div>

        {/* Korean subtitle */}
        <p className="text-ink-soft text-[0.875rem] leading-relaxed">
          서울을 방문한 외국인 관광객을 위한
          <br />
          맛집 동선 추천 앱
        </p>

        {/* QR card */}
        <div className="flex items-start gap-4 mt-1">
          <div className="rounded-xl overflow-hidden shrink-0 bg-white p-2 shadow-soft">
            <img
              src={matgilQr}
              alt="Matgil QR code"
              className="w-[4.5rem] h-[4.5rem] block"
            />
          </div>
          <div className="flex flex-col gap-1 pt-1.5">
            <p className="text-[0.8125rem] font-medium text-ink leading-snug">
              Scan to explore Matgil
              <br />
              on mobile
            </p>
            <p className="text-[0.75rem] text-ink-soft leading-snug mt-0.5">
              QR을 스캔하고 모바일에서
              <br />
              이용해보세요
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
