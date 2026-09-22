import { useState, type FormEvent } from 'react';
import './styling/Auth.css';
import { supabase } from './utils/supabase.ts';

type AuthMode = 'login' | 'signup' | 'reset';
type LoginProvider = 'email' | 'github' | 'google' | 'discord';

const LAST_LOGIN_PROVIDER_KEY = 'test-project:last-login-provider';

function GithubIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M881 442.4H519.7v148.5h206.4c-8.9 48-35.9 88.6-76.6 115.8-34.4 23-78.3 36.6-129.9 36.6-99.9 0-184.4-67.5-214.6-158.2-7.6-23-12-47.6-12-72.9s4.4-49.9 12-72.9c30.3-90.6 114.8-158.1 214.7-158.1 56.3 0 106.8 19.4 146.6 57.4l110-110.1c-66.5-62-153.2-100-256.6-100-149.9 0-279.6 86-342.7 211.4-26 51.8-40.8 110.4-40.8 172.4S151 632.8 177 684.6C240.1 810 369.8 896 519.7 896c103.6 0 190.4-34.4 253.8-93 72.5-66.8 114.4-165.2 114.4-282.1 0-27.2-2.4-53.3-6.9-78.5z" />
    </svg>
  );
}

function DiscordIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        d="M19.73 4.87a18.2 18.2 0 0 0-4.6-1.44c-.21.4-.4.8-.58 1.21-1.69-.25-3.4-.25-5.1 0-.18-.41-.37-.82-.59-1.2-1.6.27-3.14.75-4.6 1.43A19.04 19.04 0 0 0 .96 17.7a18.43 18.43 0 0 0 5.63 2.87c.46-.62.86-1.28 1.2-1.98-.65-.25-1.29-.55-1.9-.92.17-.12.32-.24.47-.37 3.58 1.7 7.7 1.7 11.28 0l.46.37c-.6.36-1.25.67-1.9.92.35.7.75 1.35 1.2 1.98 2.03-.63 3.94-1.6 5.64-2.87.47-4.87-.78-9.09-3.3-12.83ZM8.3 15.12c-1.1 0-2-1.02-2-2.27 0-1.24.88-2.26 2-2.26s2.02 1.02 2 2.26c0 1.25-.89 2.27-2 2.27Zm7.4 0c-1.1 0-2-1.02-2-2.27 0-1.24.88-2.26 2-2.26s2 1.02 2 2.26c0 1.25-.88 2.27-2 2.27Z"
      />
    </svg>
  );
}

function rememberLoginProvider(provider: LoginProvider) {
  sessionStorage.setItem(LAST_LOGIN_PROVIDER_KEY, provider);
}

function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function resetFeedback() {
    setMessage('');
    setError('');
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    resetFeedback();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    resetFeedback();

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        rememberLoginProvider('email');
        return;
      }

      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          rememberLoginProvider('email');
        } else {
          setMessage('Check your email to confirm your account.');
        }

        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) {
        throw error;
      }

      setMessage('Check your email for a password reset link.');
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Something went wrong.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGitHubLogin() {
    setLoading(true);
    resetFeedback();
    rememberLoginProvider('github');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    resetFeedback();
    rememberLoginProvider('google');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  async function handleDiscordLogin() {
    setLoading(true);
    resetFeedback();
    rememberLoginProvider('discord');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  const title =
    mode === 'login' ? 'Welcome Back!' : mode === 'signup' ? 'Create Account' : 'Reset Password';
  const submitLabel =
    mode === 'login' ? 'Login' : mode === 'signup' ? 'Sign Up' : 'Send Reset Link';

  return (
    <div className="parent">
      <main className="auth-box">
        <h1 className="welcome-label">{title}</h1>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          {mode !== 'reset' && (
            <>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </>
          )}

          <button type="submit" className="site-button auth-primary" disabled={loading}>
            {loading ? 'Loading...' : submitLabel}
          </button>
        </form>

        {mode === 'login' && (
          <>
            <div className="extras-above-all">
              <button type="button" className="site-button auth-link-button" onClick={() => switchMode('reset')}>
                Forgot password?
              </button>

              <button type="button" className="site-button auth-link-button" onClick={() => switchMode('signup')}>
                Need an account? Sign Up
              </button>
            </div>

            <div className="auth-divider">or</div>

            <button type="button" className="site-button auth-company-button auth-github" onClick={handleGitHubLogin} disabled={loading}>
              <GithubIcon />
              <span>Continue with GitHub</span>
            </button>

            <button type="button" className="site-button auth-company-button auth-google" onClick={handleGoogleLogin} disabled={loading}>
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            <button type="button" className="site-button auth-company-button auth-discord" onClick={handleDiscordLogin} disabled={loading}>
              <DiscordIcon />
              <span>Continue with Discord</span>
            </button>
          </>
        )}

        {mode === 'signup' && (
          <button type="button" className="site-button auth-link-button" onClick={() => switchMode('login')}>
            Already have an account? Login
          </button>
        )}

        {mode === 'reset' && (
          <button type="button" className="site-button auth-link-button" onClick={() => switchMode('login')}>
            Back to Login
          </button>
        )}

        {message && <p className="auth-message">{message}</p>}
        {error && <p className="auth-error">{error}</p>}
      </main>
    </div>
  );
}

export default Auth;
