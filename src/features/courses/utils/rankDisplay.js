// Soft, beige/coral-app-compatible gold/silver/bronze tones — shared between
// PublicCourseCard and PublicPlaceCard so the 1st/2nd/3rd rank colors never
// drift between the two public-feed cards.
export const RANK_BAND_STYLES = {
  1: { wrap: 'bg-[#FBE9C6]', text: 'text-[#7A5A12]' },
  2: { wrap: 'bg-[#E7E9ED]', text: 'text-[#4B5563]' },
  3: { wrap: 'bg-[#EAD2BC]', text: 'text-[#7A4A26]' },
};

// Vite public/ dir, resolved through BASE_URL (not a bare '/images/...' literal)
// since production builds this app under base '/matgil/' (see vite.config.js) —
// a hardcoded root-relative path would 404 there. Decorative rank medals: every
// caller renders them with alt=""/aria-hidden.
export const RANK_MEDAL_SRC = {
  1: `${import.meta.env.BASE_URL}images/rank/medal-gold.png`,
  2: `${import.meta.env.BASE_URL}images/rank/medal-silver.png`,
  3: `${import.meta.env.BASE_URL}images/rank/medal-bronze.png`,
};
