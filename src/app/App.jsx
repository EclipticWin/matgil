import { BrowserRouter } from 'react-router-dom';
import Providers from './providers.jsx';
import AppRouter from './router.jsx';

/**
 * App keeps itself thin: it only composes global providers, the router,
 * and the centered "mobile frame" shell. Everything else lives in pages/
 * and features/.
 */
export default function App() {
  return (
    <Providers>
      <BrowserRouter>
        <div className="flex min-h-[100svh] w-full justify-center">
          <div className="relative h-[100svh] w-full max-w-app overflow-hidden bg-paper shadow-2xl">
            <AppRouter />
          </div>
        </div>
      </BrowserRouter>
    </Providers>
  );
}
