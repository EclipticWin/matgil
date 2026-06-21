import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import Button from '../../../shared/components/Button.jsx';
import { GoogleIcon, FacebookIcon, PinIcon } from '../../../shared/components/Icon.jsx';
import { ROUTES } from '../../../shared/constants/routes.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

const inputClass =
  'h-[3.25rem] w-full rounded-2xl border-[1.5px] border-ink/10 bg-white px-4 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-coral';

const socialClass =
  'flex h-[3.625rem] w-[3.625rem] items-center justify-center rounded-full bg-white shadow-soft border-[1.5px] border-ink/5 active:scale-95 transition-transform';

export default function LoginForm({ onDone }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canSubmit = email.trim() && password.trim() && !busy;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setBusy(true);
    try {
      await login({ email, password });
      onDone?.();
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setBusy(false);
    }
  };

  const handleSocial = () => {
    alert(t('login.socialComingSoon'));
  };

  return (
    <div className="flex flex-col">
      {/* brand */}
      <div className="mb-5 flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-amber to-coral text-white">
          <PinIcon size={30} />
        </div>
        <h1 className="text-center font-display text-2xl font-bold tracking-tight text-ink">
          {t('login.welcome')}
        </h1>
      </div>

      {/* email form */}
      <form className="flex flex-col gap-2.5" onSubmit={handleLogin}>
        <input
          type="email"
          autoComplete="email"
          placeholder={t('login.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder={t('login.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" full disabled={!canSubmit} className="mt-1 !shadow-none">
          {busy ? t('login.loggingIn') : t('login.login')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          full
          onClick={() => navigate(ROUTES.signup)}
        >
          {t('login.signupWithEmail')}
        </Button>
      </form>

      {/* divider */}
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink/10" />
        <span className="text-xs font-semibold text-ink-faint">{t('login.orContinueWith')}</span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      {/* social */}
      <div className="flex justify-center gap-[1.125rem]">
        <button
          type="button"
          aria-label="Continue with Google"
          className={socialClass}
          onClick={handleSocial}
        >
          <GoogleIcon />
        </button>
        <button
          type="button"
          aria-label="Continue with Facebook"
          className={socialClass}
          onClick={handleSocial}
        >
          <FacebookIcon />
        </button>
      </div>
    </div>
  );
}
