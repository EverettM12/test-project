import { useEffect, useState } from 'react';
import { supabase } from './utils/supabase.ts';
import './styling/Welcome.css';

type LoginProvider = 'email' | 'github' | 'google' | 'discord';

const LAST_LOGIN_PROVIDER_KEY = 'test-project:last-login-provider';

function getProviderLabel(provider: LoginProvider | undefined): string {
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

function getRememberedProvider(): LoginProvider | undefined {
  const provider = sessionStorage.getItem(LAST_LOGIN_PROVIDER_KEY);

  if (
    provider === 'email' ||
    provider === 'github' ||
    provider === 'google' ||
    provider === 'discord'
  ) {
    return provider;
  }

  return undefined;
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

      const rememberedProvider = getRememberedProvider();

      if (rememberedProvider) {
        setProvider(getProviderLabel(rememberedProvider));
        return;
      }

      setProvider(getProviderLabel(user.app_metadata?.provider as LoginProvider | undefined));
    }

    loadUser();
  }, []);

  function toggleMenu() {
    setMenuOpen((open) => !open);
  }

  async function signOut() {
    sessionStorage.removeItem(LAST_LOGIN_PROVIDER_KEY);
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
