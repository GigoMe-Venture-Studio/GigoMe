import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useSession } from '../lib/useSession.js';
import { fetchProfile, logOut } from '../lib/auth.js';

// The site header on every page: the GigoMe logo (the G alone on narrow
// phones), Jobs, About, and "Log in", or the
// logged-in student's name and "Log out". Under 768px the links move into a
// Menu panel (site.css).
export default function SiteHeader() {
  const { pathname } = useLocation();
  const { session } = useSession();
  const userId = session ? session.user.id : null;
  const [name, setName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const menuButton = useRef(null);

  // The name can change on /welcome, so load it again on each page change.
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
  }, [userId, pathname]);

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
              <span className="header-user" title={label}>{label}</span>
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
            <button type="button" onClick={onLogOut}>Log out</button>
          )}
        </nav>
      )}
      {error && (
        <p className="wrap err header-error" role="alert">{error}</p>
      )}
    </header>
  );
}
