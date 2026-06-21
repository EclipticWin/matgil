/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: '#FBF2E6', soft: '#FFFBF4' },
        ink: { DEFAULT: '#261A11', soft: '#7A6A5B', faint: '#A8998A' },
        coral: { DEFAULT: '#F8481F', deep: '#D5350E', tint: '#FFEDE5' },
        amber: '#FFB22E',
        green: { DEFAULT: '#14A06A', tint: '#E2F4EC' },
        map: { land: '#F1E6D2', block: '#EADCC3', road: '#FFFBF5', park: '#CFE3B6', water: '#BBDDEC' },
      },
      fontFamily: {
        display: ['Pretendard', '"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Pretendard', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        app: '22.5rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(38,26,17,0.06), 0 2px 8px rgba(38,26,17,0.05)',
        card: '0 4px 14px rgba(38,26,17,0.10), 0 12px 30px rgba(38,26,17,0.08)',
        coral: '0 6px 16px rgba(248,72,31,0.4)',
      },
    },
  },
  plugins: [],
};
