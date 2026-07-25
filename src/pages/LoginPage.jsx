import { useLocation, useNavigate } from 'react-router-dom';
import LoginForm from '../features/auth/components/LoginForm.jsx';
import TopBar from '../shared/components/TopBar.jsx';
import BottomNavigation from '../features/navigation/components/BottomNavigation.jsx';
import { resolveAfterLoginPath } from '../shared/utils/authRedirect.js';

/** Login / sign-up — keeps the same brand bar + bottom navigation as the app.
 *  `location.state.returnTo` (set by goToLoginWithReturn() at whichever "log in
 *  required" prompt sent the user here) takes priority over the default
 *  post-login destination — see authRedirect.js. Direct visits to this page
 *  (no returnTo, e.g. typed URL or the bottom-nav My tab guard) fall back to
 *  that same existing default, unchanged. */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo;

  return (
    <div className="relative flex h-full flex-col bg-paper">
      <TopBar />
      <main className="no-scrollbar flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-center px-6 pb-10 pt-10">
          <LoginForm
            returnTo={returnTo}
            onDone={() => navigate(resolveAfterLoginPath(returnTo), { replace: true })}
          />
        </div>
      </main>
      <BottomNavigation />
    </div>
  );
}
