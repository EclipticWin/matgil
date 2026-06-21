/**
 * Inline SVG icon set. Stroke icons inherit color via `currentColor`
 * (set it with a Tailwind text-* class). Brand logos keep fixed colors.
 */
function Svg({ size = 20, vb = '0 0 24 24', className = '', children, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox={vb} fill={fill} className={className}>
      {children}
    </svg>
  );
}

export function BackIcon(p) {
  return (
    <Svg vb="0 0 20 20" {...p}>
      <path d="M12.5 4l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SearchIcon(p) {
  return (
    <Svg vb="0 0 20 20" {...p}>
      <circle cx="9" cy="9" r="6.2" stroke="currentColor" strokeWidth="2" />
      <path d="M14 14l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function FilterIcon(p) {
  return (
    <Svg vb="0 0 20 20" {...p}>
      <path d="M3 5h14M5.5 10h9M8.5 15h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

/** Funnel / sliders-style filter icon for use without a colored background. */
export function FunnelIcon(p) {
  return (
    <Svg vb="0 0 20 20" {...p}>
      <path d="M2.5 4.5h15l-6 7v5l-3-1.5v-3.5z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function StarIcon(p) {
  return (
    <Svg vb="0 0 14 14" {...p}>
      <path
        d="M7 1l1.7 3.6 3.9.5-2.9 2.7.8 3.9L7 9.9 3.5 11.7l.8-3.9L1.4 5.1l3.9-.5L7 1z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function WalkIcon(p) {
  return (
    <Svg vb="0 0 14 14" {...p}>
      <circle cx="8" cy="2.4" r="1.5" fill="currentColor" />
      <path
        d="M8 4.5l-2.4 1.2L4 9m4-4.5l1.6 1 1.4 2M8 4.5v3.5l1.6 4M6.2 8l-1.4 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ClockIcon(p) {
  return (
    <Svg vb="0 0 14 14" {...p}>
      <circle cx="7" cy="7" r="5.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 4.2V7l1.9 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PinIcon(p) {
  return (
    <Svg vb="0 0 16 16" {...p}>
      <path d="M8 1.2c-2.9 0-5.2 2.2-5.2 5 0 3.6 5.2 8.6 5.2 8.6s5.2-5 5.2-8.6c0-2.8-2.3-5-5.2-5z" fill="currentColor" />
      <circle cx="8" cy="6.1" r="1.9" fill="#fff" />
    </Svg>
  );
}

export function HeartIcon({ active, ...p }) {
  return (
    <Svg vb="0 0 22 22" {...p}>
      <path
        d="M11 19s-7-4.6-7-9.7A4.3 4.3 0 0111 6.5 4.3 4.3 0 0118 9.3c0 5.1-7 9.7-7 9.7z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SpeakerIcon(p) {
  return (
    <Svg vb="0 0 22 22" {...p}>
      <path d="M4 8.5v5h3l4 3.3v-11.6L7 8.5H4z" fill="currentColor" />
      <path d="M15 8c1.3 1.2 1.3 4.8 0 6M17.4 5.8c2.3 2 2.3 8.4 0 10.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function CommentIcon(p) {
  return (
    <Svg vb="0 0 18 18" {...p}>
      <path d="M3 4.5h12v8H8l-3.5 3v-3H3v-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  );
}

export function PencilIcon(p) {
  return (
    <Svg vb="0 0 18 18" {...p}>
      <path d="M12.4 2.9l2.7 2.7L6 14.7l-3.1.5.5-3.1L12.4 2.9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  );
}

export function CheckIcon(p) {
  return (
    <Svg vb="0 0 18 18" {...p}>
      <path d="M4 9.5l3.2 3.2L14 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRightIcon(p) {
  return (
    <Svg vb="0 0 8 14" {...p}>
      <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ArrowRightIcon(p) {
  return (
    <Svg vb="0 0 16 16" {...p}>
      <path d="M3 8h9m0 0L8.5 4.5M12 8l-3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SparkleIcon(p) {
  return (
    <Svg {...p}>
      <path
        d="M12 3l1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8L12 3z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function CloseIcon(p) {
  return (
    <Svg vb="0 0 18 18" {...p}>
      <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

export function ImagePlaceholderIcon(p) {
  return (
    <Svg {...p}>
      <circle cx="8.5" cy="8.5" r="1.9" fill="currentColor" />
      <path d="M3.5 17l4.5-4.8 3 3.1 4-4.4 5.5 6.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* ── bottom-navigation tab icons (support an `active` fill) ── */
export function HomeIcon({ active, ...p }) {
  return (
    <Svg size={22} {...p}>
      <path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.4" fill={active ? '#fff' : 'none'} stroke={active ? '#fff' : 'currentColor'} strokeWidth="1.9" />
    </Svg>
  );
}

export function FlameIcon({ active, ...p }) {
  return (
    <Svg size={22} {...p}>
      <path
        d="M12 3c2.2 2.5.6 4.2-.1 6-.6 1.5.3 2.7 1.4 1.3.7-.9.7-1.9.7-1.9 2 1.7 2.4 3.9 2.4 5.3a6.4 6.4 0 11-12.8 0c0-2.2 1.4-3.9 2.5-5.3 1-1.3 2.6-3.2 1.9-5.4z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChatIcon({ active, ...p }) {
  return (
    <Svg size={22} {...p}>
      <path d="M4 5h16v10H9l-4 4v-4H4V5z" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M8 9h8M8 12h5" stroke={active ? '#fff' : 'currentColor'} strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function BookmarkIcon({ active, ...p }) {
  return (
    <Svg size={22} {...p}>
      <path d="M6 4h12v16l-6-4-6 4V4z" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </Svg>
  );
}

export function UserIcon({ active, ...p }) {
  return (
    <Svg size={22} {...p}>
      <circle cx="12" cy="8" r="3.4" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </Svg>
  );
}

export function RouteIcon({ active, ...p }) {
  return (
    <Svg size={22} {...p}>
      <path d="M7 5v9a3 3 0 003 3h4a3 3 0 003 3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="4.5" r="2.3" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17" cy="19.5" r="2.3" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" />
    </Svg>
  );
}

export function UsersIcon({ active, ...p }) {
  return (
    <Svg size={22} {...p}>
      <circle cx="8.5" cy="8" r="3" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" />
      <circle cx="16.5" cy="9.5" r="2.3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M15 19c.2-2.3 1.8-3.5 3.5-3.5s3.3 1.2 3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function NavIcon(p) {
  return (
    <Svg vb="0 0 18 18" {...p}>
      <path d="M16 2L2 8l6 2 2 6 6-14z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </Svg>
  );
}

export function GlobeIcon(p) {
  return (
    <Svg vb="0 0 18 18" {...p}>
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 9h14M9 2c2 2.3 2 11.7 0 14M9 2C7 4.3 7 13.7 9 16" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function MicIcon(p) {
  return (
    <Svg vb="0 0 24 24" {...p}>
      <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="9" y1="22" x2="15" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

/* ── brand logos (fixed colors) ── */
export function GoogleIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.4 5.4 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.21 7.21 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

export function LocateIcon(p) {
  return (
    <Svg vb="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
      <path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

export function FacebookIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        fill="#1877F2"
        d="M24 12a12 12 0 1 0-13.875 11.854v-8.385H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.469h-2.796v8.385A12.002 12.002 0 0 0 24 12z"
      />
    </svg>
  );
}
