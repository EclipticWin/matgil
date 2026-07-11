/** Category glyphs for the filter sheet. Each inherits `currentColor`, so set
 *  the colour with a Tailwind text-* class on the icon. */
const PATHS = {
  default: <circle cx="9" cy="9" r="5" fill="currentColor" />,
  all: (
    <>
      <rect x="2.5" y="2.5" width="5" height="5" rx="1.4" fill="currentColor" />
      <rect x="10.5" y="2.5" width="5" height="5" rx="1.4" fill="currentColor" />
      <rect x="2.5" y="10.5" width="5" height="5" rx="1.4" fill="currentColor" />
      <rect x="10.5" y="10.5" width="5" height="5" rx="1.4" fill="currentColor" />
    </>
  ),
  bbq: (
    <path
      d="M9 2.4c1.6 1.8.4 3-.1 4.3-.4 1 .2 1.9 1 .9.5-.6.5-1.3.5-1.3 1.4 1.2 1.7 2.8 1.7 3.8a4.1 4.1 0 11-8.2 0c0-1.6 1-2.8 1.8-3.8.7-.9 1.9-2.3 1.4-3.9z"
      fill="currentColor"
    />
  ),
  street: (
    <>
      <path d="M4 6h10l-1 3.2H5L4 6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 2.6v3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="6" cy="13.5" r="1.4" fill="currentColor" />
      <circle cx="12" cy="13.5" r="1.4" fill="currentColor" />
    </>
  ),
  noodle: (
    <>
      <path d="M2.8 8.5h12.4c0 3.2-2.8 5.6-6.2 5.6S2.8 11.7 2.8 8.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 8V4.5M9 8V3.6M12 8V4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  cafe: (
    <>
      <path d="M4 6.5h8v4a3 3 0 01-3 3H7a3 3 0 01-3-3v-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 7.5h1.6a1.6 1.6 0 010 3.2H12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 2.8c-.6.8-.6 1.4 0 2.2M9.4 2.8c-.6.8-.6 1.4 0 2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  stew: (
    <>
      <path d="M3.4 7.5h11.2v2.2a4.6 4.6 0 01-4.6 4.6H8a4.6 4.6 0 01-4.6-4.6V7.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2.4 7.5h13.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 4.2c-.5.6-.5 1.2 0 1.8M10.6 4c-.5.6-.5 1.2 0 1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  chicken: (
    <path
      d="M11.5 3.2a3.4 3.4 0 00-4.6 4.9L4.4 10.6a2 2 0 102.9 2.9l2.5-2.5a3.4 3.4 0 001.7-7.8z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  ),
};

export default function CategoryIcon({ name, size = 17, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      {PATHS[name] || PATHS.default}
    </svg>
  );
}
