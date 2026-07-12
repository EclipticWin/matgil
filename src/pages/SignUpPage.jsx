import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { useNicknameAvailability } from '../features/auth/hooks/useNicknameAvailability.js';
import { ROUTES } from '../shared/constants/routes.js';
import Button from '../shared/components/Button.jsx';
import TopBar from '../shared/components/TopBar.jsx';
import BottomNavigation from '../features/navigation/components/BottomNavigation.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

const inputClass =
  'h-[3.25rem] w-full rounded-2xl border-[1.5px] border-ink/10 bg-white px-4 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-coral';

// Nickname is the one field here with live availability feedback, so it gets its own
// focus color — a weak stone ring instead of the shared coral used by the other fields.
const nicknameInputClass =
  'h-[3.25rem] w-full rounded-2xl border-[1.5px] border-ink/10 bg-white px-4 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-stone-400';

const AUTH_ERROR_KO = {
  'User already registered': '이미 가입된 이메일입니다.',
  'Password should be at least 6 characters': '비밀번호는 6자 이상이어야 합니다.',
  'Signup is disabled': '현재 회원가입을 사용할 수 없습니다.',
  'Email not confirmed': '이메일 인증을 완료해 주세요.',
};

function mapAuthError(msg, locale) {
  if (locale !== 'ko' || !msg) return msg;
  for (const [en, ko] of Object.entries(AUTH_ERROR_KO)) {
    if (msg.includes(en)) return ko;
  }
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export default function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nicknameFallback, setNicknameFallback] = useState(false);
  const [busy, setBusy] = useState(false);

  const nicknameStatus = useNicknameAvailability(displayName);
  const canSubmit = email.trim() && password.trim() && confirm.trim() && !busy && nicknameStatus !== 'taken';

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
      const { needsConfirmation, nicknameFallback: fellBack } = await signUp({
        email,
        password,
        displayName: displayName.trim() || undefined,
      });
      if (needsConfirmation) {
        setSuccess('Account created! Please check your email to confirm your account.');
      } else if (fellBack) {
        setNicknameFallback(true);
        setSuccess(t('signup.nicknameTakenFallback'));
      } else {
        navigate(ROUTES.community, { replace: true });
      }
    } catch (err) {
      setError(mapAuthError(err.message || 'Sign up failed. Please try again.', locale));
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
                onClick={() => (nicknameFallback ? navigate(ROUTES.community, { replace: true }) : navigate(ROUTES.login))}
              >
                {nicknameFallback ? t('signup.continueToApp') : 'Back to Login'}
              </button>
            </div>
          ) : (
            <form className="flex flex-col gap-2.5" onSubmit={handleSubmit}>
              <div>
                <input
                  type="text"
                  autoComplete="nickname"
                  maxLength={20}
                  placeholder={t('signup.displayName')}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={nicknameInputClass}
                />
                {nicknameStatus === 'taken' ? (
                  <p className="mt-1 px-1 text-xs text-red-600">{t('signup.nicknameTaken')}</p>
                ) : nicknameStatus === 'checking' ? (
                  <p className="mt-1 px-1 text-xs text-ink-faint">{t('signup.nicknameChecking')}</p>
                ) : (
                  <p className="mt-1 px-1 text-xs text-ink-faint">{t('signup.displayNameHint')}</p>
                )}
              </div>
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
