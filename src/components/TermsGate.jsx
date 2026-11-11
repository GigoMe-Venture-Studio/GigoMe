import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from '../lib/useSession.js';
import { fetchProfile } from '../lib/auth.js';
import { acceptedInThisTab, hasAcceptedTerms } from '../lib/terms.js';

// Pages a logged-in account can open before accepting the current Terms:
// where it accepts them (/welcome, and the employer setup, which asks too),
// the texts themselves, the login pages, and /account (to download its data
// or delete the account without accepting anything).
const OPEN = ['/welcome', '/login', '/employers', '/employers/setup', '/privacy', '/terms', '/account'];

// Every logged-in account must have accepted the current Terms
// (TERMS_VERSION). One that hasn't (new accounts, accounts from before the
// Terms were asked for, and everyone once the version changes) is sent to
// /welcome once, then back to the page it asked for. The profile is checked
// once per login and again when /welcome announces a change; while it loads,
// or if it can't be loaded, the page is shown as usual.
export default function TermsGate({ children }) {
  const { pathname, search, hash } = useLocation();
  const { session } = useSession();
  const userId = session ? session.user.id : null;
  const [state, setState] = useState({ userId: null, accepted: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((n) => n + 1);
    window.addEventListener('gigome:profile-changed', bump);
    return () => window.removeEventListener('gigome:profile-changed', bump);
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    fetchProfile(userId)
      .then((p) => active && setState({ userId, accepted: !p || hasAcceptedTerms(p) }))
      .catch(() => active && setState({ userId, accepted: true }));
    return () => {
      active = false;
    };
  }, [userId, version]);

  if (userId && state.userId === userId && !state.accepted && !acceptedInThisTab(userId) && !OPEN.includes(pathname)) {
    return <Navigate to={'/welcome?next=' + encodeURIComponent(pathname + search + hash)} replace />;
  }
  return children;
}
