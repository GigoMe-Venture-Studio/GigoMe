import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useSession } from '../lib/useSession.js';
import { fetchProfile, logOut } from '../lib/auth.js';

// A link to one of the demo's screens on the home page (#jobs, #about, ...).
// The demo switches screens on `hashchange`. On the home page this must be a
// plain fragment link, because React Router's <Link> uses pushState, which
// fires no hashchange. Anywhere else, a <Link> to "/#jobs" mounts the home
// page, which then opens that screen.
function DemoLink({ onHome, hash, className, current, onClick, children }) {
  const aria = current ? 'page' : undefined;
  if (onHome) return <a href={hash} className={className} aria-current={aria} onClick={onClick}>{children}</a>;
  return <Link to={'/' + hash} className={className} onClick={onClick}>{children}</Link>;
}

// The site header on every page: GigoMe, Jobs (/jobs), About (the demo's
// #about screen), and "Log in", or the
// logged-in student's name and "Log out". Under 768px the links move into a
// Menu panel (site.css).
export default function SiteHeader() {
  const { pathname, hash } = useLocation();
  const onHome = pathname === '/';
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

  useEffect(() => setMenuOpen(false), [pathname, hash]);

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

  const screen = onHome ? (hash.replace('#', '').split('/')[0] || 'home') : '';
  const jobsCurrent = pathname === '/jobs' || pathname.startsWith('/jobs/');
  const aboutCurrent = screen === 'about';
  const label = name || (session ? session.user.email : '');

  return (
    <header className="site-header">
      <div className="wrap">
        {onHome ? (
          <a className="wordmark" href="#home">GigoMe</a>
        ) : (
          <Link className="wordmark" to="/">GigoMe</Link>
        )}
        <nav className="main-nav" aria-label="Main">
          <Link to="/jobs" aria-current={jobsCurrent ? 'page' : undefined}>Jobs</Link>
          <DemoLink onHome={onHome} hash="#about" current={aboutCurrent}>About</DemoLink>
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
          <DemoLink onHome={onHome} hash="#about" current={aboutCurrent} onClick={() => setMenuOpen(false)}>About</DemoLink>
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
