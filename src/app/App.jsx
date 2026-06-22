import { BrowserRouter } from 'react-router-dom';
import Providers from './providers.jsx';
import AppRouter from './router.jsx';

// dev: BASE_URL='/' → no basename needed
// prod (GitHub Pages): BASE_URL='/matgil/' → basename='/matgil'
const base = import.meta.env.BASE_URL ?? '/';
const basename = base === '/' ? undefined : base.replace(/\/$/, '');

export default function App() {
  return (
    <Providers>
      <BrowserRouter basename={basename}>
        <div className="flex min-h-[100svh] w-full justify-center">
          <div className="relative h-[100svh] w-full max-w-app overflow-hidden bg-paper shadow-2xl">
            <AppRouter />
          </div>
        </div>
      </BrowserRouter>
    </Providers>
  );
}
