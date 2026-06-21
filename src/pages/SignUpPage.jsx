import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import Button from '../shared/components/Button.jsx';
import TopBar from '../shared/components/TopBar.jsx';
import BottomNavigation from '../features/navigation/components/BottomNavigation.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

const inputClass =
  'h-[3.25rem] w-full rounded-2xl border-[1.5px] border-ink/10 bg-white px-4 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-coral';

export default function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { t } = useLocale();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const canSubmit = email.trim() && password.trim() && confirm.trim() && !busy;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp({
        email,
        password,
        displayName: displayName.trim() || undefined,
      });
      if (needsConfirmation) {
        setSuccess('Account created! Please check your email to confirm your account.');
      } else {
        navigate(ROUTES.community, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col bg-paper">
      <TopBar />
      <main className="no-scrollbar flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-center px-6 pb-10 pt-10">
          <div className="mb-7 text-center">
            <h1 className="font-display text-2xl font-bold text-ink">{t('signup.title')}</h1>
            <p className="mt-2 text-sm text-ink-soft">{t('signup.subtitle')}</p>
          </div>

          {success ? (
            <div className="rounded-2xl bg-green-tint px-5 py-6 text-center">
              <p className="text-sm font-semibold text-green">{success}</p>
              <button
                className="mt-4 text-sm font-bold text-coral underline"
                onClick={() => navigate(ROUTES.login)}
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form className="flex flex-col gap-2.5" onSubmit={handleSubmit}>
              <input
                type="text"
                autoComplete="nickname"
                placeholder={t('signup.displayName')}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
              />
              <input
                type="email"
                autoComplete="email"
                placeholder={t('signup.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder={t('signup.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder={t('signup.confirmPassword')}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">
                  {error}
                </p>
              )}
              <Button type="submit" full disabled={!canSubmit} className="mt-1">
                {busy ? t('signup.creating') : t('signup.signup')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                full
                onClick={() => navigate(ROUTES.login)}
              >
                {t('signup.backToLogin')}
              </Button>
            </form>
          )}
        </div>
      </main>
      <BottomNavigation />
    </div>
  );
}
