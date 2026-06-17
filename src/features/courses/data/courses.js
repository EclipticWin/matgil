/**
 * Hand-picked eating routes ("동선코스"). Each course embeds its own stops so
 * the feature is self-contained — `accent` tints the detail header + badge.
 */
export const COURSES = [
  {
    id: 'c1',
    title: 'Myeongdong Night Eats',
    km: '1.4 km',
    hr: '~2 hr',
    accent: '#F8481F',
    blurb:
      'A classic after-dark crawl through Myeongdong — start with street snacks, settle into BBQ and chi-maek, then finish with comforting noodles.',
    stops: [
      { id: 'r4', name: 'Tteok Street Kitchen', cuisine: 'Street Food · Tteokbokki', rating: 4.6, tint: '#FBE0E4' },
      { id: 'r2', name: 'Gogi House BBQ', cuisine: 'Korean BBQ · Pork belly', rating: 4.7, tint: '#FFEFC9' },
      { id: 'r6', name: 'Chimaek Corner', cuisine: 'Chicken · Beer', rating: 4.7, tint: '#FFE0CE' },
      { id: 'r1', name: 'Myeongdong Gyoza', cuisine: 'Dumplings · Kalguksu', rating: 4.8, tint: '#FFE3D4' },
    ],
  },
  {
    id: 'c2',
    title: 'Gwangjang Market Tasting',
    km: '0.8 km',
    hr: '~1.5 hr',
    accent: '#FFB22E',
    blurb:
      "Graze your way through Seoul's most famous market alley and the streets around it, one small plate at a time.",
    stops: [
      { id: 'r7', name: 'Gwangjang Bites', cuisine: 'Street Food · Bindaetteok', rating: 4.8, tint: '#E6E9F7' },
      { id: 'r4', name: 'Tteok Street Kitchen', cuisine: 'Street Food · Tteokbokki', rating: 4.6, tint: '#FBE0E4' },
      { id: 'r8', name: 'Seoul Ramyeon Lab', cuisine: 'Noodles · Ramyeon', rating: 4.4, tint: '#E2F1DE' },
    ],
  },
  {
    id: 'c3',
    title: 'Bukchon Café Hop',
    km: '1.1 km',
    hr: '~1 hr',
    accent: '#14A06A',
    blurb:
      'A slow afternoon of specialty coffee and traditional tea between the hanok rooftops of Bukchon.',
    stops: [
      { id: 'r3', name: 'Hodu Coffee Bar', cuisine: 'Coffee · Walnut cake', rating: 4.9, tint: '#E2F1DE' },
      { id: 'r9', name: 'Hanok Tea Room', cuisine: 'Café · Traditional tea', rating: 4.9, tint: '#FFEFC9' },
    ],
  },
];

export const getCourse = (id) => COURSES.find((c) => c.id === id);
