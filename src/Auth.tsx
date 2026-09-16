import { useState, type FormEvent } from 'react';
import './styling/Auth.css';
import { supabase } from './utils/supabase.ts';

type AuthMode = 'login' | 'signup' | 'reset';

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

        if (!data.session) {
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
            <button type="button" className="site-button auth-link-button" onClick={() => switchMode('reset')}>
              Forgot password?
            </button>

            <div className="auth-divider">or</div>

            <button type="button" className="site-button auth-github" onClick={handleGitHubLogin} disabled={loading}>
              Continue with GitHub
            </button>

            <button type="button" className="site-button auth-link-button" onClick={() => switchMode('signup')}>
              Need an account? Sign Up
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
