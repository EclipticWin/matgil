import { useNavigate } from 'react-router-dom';
import LoginForm from '../features/auth/components/LoginForm.jsx';
import TopBar from '../shared/components/TopBar.jsx';
import BottomNavigation from '../features/navigation/components/BottomNavigation.jsx';
import { ROUTES } from '../shared/constants/routes.js';

/** Login / sign-up — keeps the same brand bar + bottom navigation as the app. */
export default function LoginPage() {
  const navigate = useNavigate();
  return (
    <div className="relative flex h-full flex-col bg-paper">
      <TopBar />
      <main className="no-scrollbar flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-center px-6 pb-10 pt-10">
          <LoginForm onDone={() => navigate(ROUTES.my, { replace: true })} />
        </div>
      </main>
      <BottomNavigation />
    </div>
  );
}
