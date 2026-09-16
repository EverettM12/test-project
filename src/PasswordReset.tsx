import { useState, type FormEvent } from 'react';
import './styling/Auth.css';
import { supabase } from './utils/supabase.ts';

type PasswordResetProps = {
  onComplete: () => void;
};

function PasswordReset({ onComplete }: PasswordResetProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    onComplete();
    setLoading(false);
  }

  return (
    <div className="parent">
      <main className="auth-box">
        <h1 className="welcome-label">Choose a New Password</h1>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="new-password">New Password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />

          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            minLength={6}
            required
          />

          <button type="submit" className="site-button auth-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Set Password'}
          </button>
        </form>

        {error && <p className="auth-error">{error}</p>}
      </main>
    </div>
  );
}

export default PasswordReset;
