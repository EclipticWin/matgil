import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import Button from '../../../shared/components/Button.jsx';
import { GoogleIcon, FacebookIcon, PinIcon } from '../../../shared/components/Icon.jsx';

const inputClass =
  'h-[3.25rem] w-full rounded-2xl border-[1.5px] border-ink/10 bg-white px-4 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-coral';

const socialClass =
  'flex h-[3.625rem] w-[3.625rem] items-center justify-center rounded-full bg-white shadow-soft border-[1.5px] border-ink/5 active:scale-95 transition-transform';

/**
 * Email + social login form (mock). Any email/password logs the user in.
 * `onDone` fires after a successful login so the page can navigate away.
 */
export default function LoginForm({ onDone }) {
  const { login, signUp, loginWithProvider } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const canSubmit = email.trim() && password.trim();

  const finish = (promise) => promise.then(() => onDone?.());

  return (
    <div className="flex flex-col">
      {/* brand */}
      <div className="mb-7 flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-amber to-coral text-white shadow-coral">
          <PinIcon size={30} />
        </div>
        <h1 className="text-center font-display text-2xl font-bold tracking-tight text-ink">
          Welcome to Matgil
        </h1>
        <p className="mt-2 max-w-[16rem] text-center text-sm leading-relaxed text-ink-soft">
          Log in to save spots, routes and reviews
        </p>
      </div>

      {/* email form */}
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) finish(login({ email, password }));
        }}
      >
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <Button type="submit" full disabled={!canSubmit} className="mt-1">
          Log in
        </Button>
        <Button
          type="button"
          variant="secondary"
          full
          onClick={() => finish(signUp({ email, password }))}
        >
          Sign up with email
        </Button>
      </form>

      {/* divider */}
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink/10" />
        <span className="text-xs font-semibold text-ink-faint">or continue with</span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      {/* social */}
      <div className="flex justify-center gap-[1.125rem]">
        <button type="button" aria-label="Continue with Google" className={socialClass} onClick={() => finish(loginWithProvider('google'))}>
          <GoogleIcon />
        </button>
        <button type="button" aria-label="Continue with Facebook" className={socialClass} onClick={() => finish(loginWithProvider('facebook'))}>
          <FacebookIcon />
        </button>
      </div>
    </div>
  );
}
