import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// The current Supabase session, kept up to date. supabase-js stores it in
// localStorage, so it survives reloads and closing the tab.
export function useSession() {
  const [state, setState] = useState({ session: null, loading: Boolean(supabase) });

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, loading: false });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
