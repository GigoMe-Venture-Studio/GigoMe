import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useSession } from '../lib/useSession.js';
import { fetchProfile, logOut } from '../lib/auth.js';

// The site header on every page: the GigoMe logo (the G alone on narrow
// phones), Jobs, About, and "Log in", or the logged-in student's name (a link
// to /account) and "Log out". Under 768px the links move into a
// Menu panel (site.css).
export default function SiteHeader() {
  const { pathname } = useLocation();
  const { session } = useSession();
  const userId = session ? session.user.id : null;
  const [name, setName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const menuButton = useRef(null);

  // The name changes on /welcome and /account (they announce it), so load it
  // again then and on each page change.
  const [profileVersion, setProfileVersion] = useState(0);
  useEffect(() => {
    const bump = () => setProfileVersion((n) => n + 1);
    window.addEventListener('gigome:profile-changed', bump);
    return () => window.removeEventListener('gigome:profile-changed', bump);
  }, []);

  useEffect(() => {
    if (!userId) {
      setName('');
      return undefined;
    }
    let active = true;
    fetchProfile(userId)
      .then((p) => active && setName((p && p.full_name) || ''))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId, pathname, profileVersion]);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        if (menuButton.current) menuButton.current.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  async function onLogOut() {
    setMenuOpen(false);
    setError((await logOut()) || '');
  }

  const jobsCurrent = pathname === '/jobs' || pathname.startsWith('/jobs/');
  const aboutCurrent = pathname === '/about';
  const accountCurrent = pathname === '/account';
  const label = name || (session ? session.user.email : '');

  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="site-logo" to="/">
          <picture>
            <source media="(max-width: 359px)" srcSet="/brand/header-mark.webp" width="35" height="30" />
            <img src="/brand/header-wordmark.webp" alt="GigoMe" width="132" height="30" />
          </picture>
        </Link>
        <nav className="main-nav" aria-label="Main">
          <Link to="/jobs" aria-current={jobsCurrent ? 'page' : undefined}>Jobs</Link>
          <Link to="/about" aria-current={aboutCurrent ? 'page' : undefined}>About</Link>
        </nav>
        <div className="header-actions">
          {session ? (
            <>
              <Link
                className="header-user"
                to="/account"
                title={`${label}: your account`}
                aria-label={`Your account (${label})`}
                aria-current={accountCurrent ? 'page' : undefined}
              >
                {label}
              </Link>
              <button type="button" className="btn btn-tertiary btn-sm signin" onClick={onLogOut}>
                Log out
              </button>
            </>
          ) : (
            <Link className="btn btn-primary btn-sm" to="/login">Log in</Link>
          )}
          <button
            type="button"
            ref={menuButton}
            className="btn btn-secondary btn-sm menu-btn"
            id="menu-btn"
            aria-expanded={menuOpen}
            aria-controls="menu-panel"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="menu-panel" id="menu-panel" aria-label="Mobile">
          <Link to="/jobs" aria-current={jobsCurrent ? 'page' : undefined} onClick={() => setMenuOpen(false)}>Jobs</Link>
          <Link to="/about" aria-current={aboutCurrent ? 'page' : undefined} onClick={() => setMenuOpen(false)}>About</Link>
          {session && (
            <>
              <Link
                className="menu-user"
                to="/account"
                aria-label={`Your account (${label})`}
                aria-current={accountCurrent ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
              <button type="button" onClick={onLogOut}>Log out</button>
            </>
          )}
        </nav>
      )}
      {error && (
        <p className="wrap err header-error" role="alert">{error}</p>
      )}
    </header>
  );
}
