import { useCallback, useEffect, useState } from 'react';
import { useSession } from './useSession.js';
import { fetchProfile } from './auth.js';
import { fetchMyCompany } from './employer.js';

// For the employer pages. status is one of:
//   loading, loggedOut, student (not a company account), noCompany, ready, error
export function useCompanyAccount() {
  const { session, loading } = useSession();
  const userId = session ? session.user.id : null;
  const [state, setState] = useState({ status: 'loading', company: null });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((n) => n + 1), []);

  useEffect(() => {
    if (loading) return undefined;
    if (!userId) {
      setState({ status: 'loggedOut', company: null });
      return undefined;
    }
    let active = true;
    (async () => {
      try {
        const profile = await fetchProfile(userId);
        if (!active) return;
        if (profile && profile.account_type !== 'company') {
          setState({ status: 'student', company: null });
          return;
        }
        const company = await fetchMyCompany(userId);
        if (active) setState({ status: company ? 'ready' : 'noCompany', company });
      } catch {
        if (active) setState({ status: 'error', company: null });
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, loading, version]);

  return { ...state, session, setCompany: (company) => setState({ status: 'ready', company }), reload };
}
