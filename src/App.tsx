import { useEffect, useState } from 'react';
import './styling/App.css';
import Auth from './Auth.tsx';
import PasswordReset from './PasswordReset.tsx';
import Welcome from './Welcome.tsx';
import { supabase } from './utils/supabase.ts';
import type { Session } from '@supabase/supabase-js';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) {
        return;
      }

      setSession(session);
      setRecovery(event === 'PASSWORD_RECOVERY');
      setLoading(false);
    });

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted) {
        setSession(session);
        setLoading(false);
      }
    }

    loadSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return null;
  }

  if (recovery) {
    return <PasswordReset onComplete={() => setRecovery(false)} />;
  }

  return session ? <Welcome /> : <Auth />;
}

export default App;
