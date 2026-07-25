import { BrowserRouter } from 'react-router-dom';
import Providers from './providers.jsx';
import AppRouter from './router.jsx';
import DesktopIntroPanel from '../shared/components/DesktopIntroPanel.jsx';
import AuthRequiredModal from '../features/places/components/AuthRequiredModal.jsx';
import { useAuthPrompt } from '../features/auth/hooks/useAuthPrompt.jsx';

// dev: BASE_URL='/' → no basename needed
// prod (GitHub Pages): BASE_URL='/matgil/' → basename='/matgil'
const base = import.meta.env.BASE_URL ?? '/';
const basename = base === '/' ? undefined : base.replace(/\/$/, '');

/** Renders the single app-wide login prompt only while one is actually open —
 *  when `prompt` is null this returns null, so there is NO wrapper div, no
 *  backdrop, no overlay of any kind in the DOM (not zero-sized, not
 *  pointer-events-none: entirely absent). A previous version kept an
 *  always-mounted `<div className="relative z-50">` here regardless of
 *  `prompt`, sized only by its content — since Modal.jsx's own overlay is
 *  `absolute inset-0`, that wrapper never established a definite width/height
 *  containing block, which made the (supposedly invisible, closed) backdrop
 *  render inconsistently over the whole app and block every click. Mounting
 *  this conditionally, and giving the wrapper explicit `absolute inset-0`
 *  only while it exists, avoids both problems at once. */
function AuthPromptRenderer() {
  const { prompt, closeAuthPrompt } = useAuthPrompt();
  if (!prompt) return null;
  return (
    <div className="absolute inset-0 z-50">
      <AuthRequiredModal open onClose={closeAuthPrompt} bodyKey={prompt.messageKey} returnTo={prompt.returnTo} />
    </div>
  );
}

export default function App() {
  return (
    <Providers>
      <BrowserRouter basename={basename}>
        <div className="flex min-h-[100svh] w-full items-stretch justify-center lg:gap-6">
          <DesktopIntroPanel />
          <div className="relative h-[100svh] w-full max-w-app overflow-hidden bg-paper shadow-2xl">
            <AppRouter />
            {/* Mounted above the whole route tree (not inside AppLayout/HomePage/
                NearbySheet/PlaceDetailSheet), so when open its backdrop covers the
                whole app frame — map, bottom navigation, header — instead of being
                clipped by whichever nested sheet triggered it. Renders nothing at
                all while closed — see AuthPromptRenderer above. */}
            <AuthPromptRenderer />
          </div>
        </div>
      </BrowserRouter>
    </Providers>
  );
}
