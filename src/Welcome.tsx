import { useEffect, useState } from 'react';
import { supabase } from './utils/supabase.ts';
import './styling/Welcome.css';

function getProviderLabel(provider: string | undefined): string {
  if (provider === 'github') {
    return 'GitHub';
  }

  if (provider === 'google') {
    return 'Google';
  }

  if (provider === 'discord') {
    return 'Discord';
  }

  return 'Email';
}

function Welcome() {
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState('Email');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      setEmail(user.email ?? '');

      const identities = user.identities ?? [];
      const mostRecentIdentity = identities.reduce<typeof identities[number] | null>(
        (current, identity) => {
          if (!current) {
            return identity;
          }

          const currentTime = current.last_sign_in_at
            ? new Date(current.last_sign_in_at).getTime()
            : 0;
          const identityTime = identity.last_sign_in_at
            ? new Date(identity.last_sign_in_at).getTime()
            : 0;

          return identityTime > currentTime ? identity : current;
        },
        null,
      );

      setProvider(getProviderLabel(mostRecentIdentity?.provider));
    }

    loadUser();
  }, []);

  function toggleMenu() {
    setMenuOpen((open) => !open);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="welcome-page">
      <header className="top-bar">
        <button
          type="button"
          className={`site-button menu-button${menuOpen ? ' is-open' : ''}`}
          onClick={toggleMenu}
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <aside className={`side-menu${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen}>
        <div className="side-menu-content">
          <div className="account-summary">
            <span className="account-label">Signed in with</span>
            <strong>{provider}</strong>
            <span className="account-email">{email || 'No email available'}</span>
          </div>

          <button type="button" className="site-button side-menu-action" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="welcome-content">
        <section className="welcome-card" aria-label="Account information">
          <h1>Welcome in</h1>
          <p className="welcome-detail">
            Signed in with <strong>{provider}</strong>
          </p>
          <p className="welcome-email">{email || 'Loading email...'}</p>
        </section>
      </main>

      {menuOpen && (
        <button
          type="button"
          className="menu-backdrop"
          aria-label="Close menu"
          onClick={toggleMenu}
        />
      )}
    </div>
  );
}

export default Welcome;
