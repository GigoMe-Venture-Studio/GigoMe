import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useSession } from '../lib/useSession.js';
import { fetchProfile } from '../lib/auth.js';
import LogOutButton from './LogOutButton.jsx';
import { fetchMyCompany } from '../lib/employer.js';
import LangSwitch from './LangSwitch.jsx';
import { useLang, useT } from '../lib/useLang.js';

// The site header on every page: the GigoMe logo (the G alone on narrow
// phones: under 360px, or under 400px in Italian, where "Accesso studenti"
// leaves no room for the wordmark), Jobs, then
//   logged out: "For employers" and "Student login";
//   student: "Saved jobs", their name (a link to /account) and "Log out";
//   company account: "Dashboard", the company name (a link to /account) and
//   "Log out".
// "EN | IT" (LangSwitch) sits before the buttons from 440px, and in the
// Menu panel (the only place under 440px, where the header has no room).
// Under 768px the links move into a Menu panel (site.css).
// Below these widths the logo is the G alone (LOGO_MARK_MEDIA[lang] or the
// default): the wordmark, the logged-out button and Menu must fit in one row.
const LOGO_MARK_MEDIA = { it: '(max-width: 399px)' };
const LOGO_MARK_DEFAULT = '(max-width: 359px)';

export default function SiteHeader() {
  const t = useT();
  const lang = useLang();
  const { pathname } = useLocation();
  const { session, loading } = useSession();
  const userId = session ? session.user.id : null;
  const [who, setWho] = useState({ name: '', company: '', isCompany: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const menuButton = useRef(null);

  // The name changes on /welcome, /account and the employer pages (they
  // announce it), so load it again then and on each page change.
  const [profileVersion, setProfileVersion] = useState(0);
  useEffect(() => {
    const bump = () => setProfileVersion((n) => n + 1);
    window.addEventListener('gigome:profile-changed', bump);
    return () => window.removeEventListener('gigome:profile-changed', bump);
  }, []);

  useEffect(() => {
    if (!userId) {
      setWho({ name: '', company: '', isCompany: false });
      return undefined;
    }
    let active = true;
    (async () => {
      const p = await fetchProfile(userId);
      const isCompany = Boolean(p && p.account_type === 'company');
      const company = isCompany ? await fetchMyCompany(userId, { withEmail: false }) : null;
      if (active) setWho({ name: (p && p.full_name) || '', company: (company && company.name) || '', isCompany });
    })().catch(() => {});
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

  const jobsCurrent = pathname === '/jobs' || pathname.startsWith('/jobs/');
  const accountCurrent = pathname === '/account';
  const employersCurrent = pathname === '/employers' || pathname.startsWith('/employers/');
  const dashboardCurrent = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const savedCurrent = pathname === '/saved';
  const label = (who.isCompany && who.company) || who.name || (session ? session.user.email : '');
  // Logged out: "For employers". Company accounts: "Dashboard".
  const extra = !session
    ? loading ? null : { to: '/employers', text: t('header.forEmployers'), current: employersCurrent }
    : who.isCompany
      ? { to: '/dashboard', text: t('header.dashboard'), current: dashboardCurrent }
      : { to: '/saved', text: t('header.savedJobs'), current: savedCurrent };

  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="site-logo" to="/">
          <picture>
            <source media={LOGO_MARK_MEDIA[lang] || LOGO_MARK_DEFAULT} srcSet="/brand/header-mark.webp" width="35" height="30" />
            <img src="/brand/header-wordmark.webp" alt="GigoMe" width="132" height="30" />
          </picture>
        </Link>
        <nav className="main-nav" aria-label={t('header.mainNav')}>
          <Link to="/jobs" aria-current={jobsCurrent ? 'page' : undefined}>{t('header.jobs')}</Link>
          {extra && <Link to={extra.to} aria-current={extra.current ? 'page' : undefined}>{extra.text}</Link>}
        </nav>
        <div className="header-actions">
          <LangSwitch className="header-lang" />
          {session ? (
            <>
              <Link
                className="header-user"
                to="/account"
                title={t('header.accountTitle', { name: label })}
                aria-label={t('header.accountLabel', { name: label })}
                aria-current={accountCurrent ? 'page' : undefined}
              >
                {label}
              </Link>
              <LogOutButton className="btn btn-tertiary btn-sm signin" onError={setError} />
            </>
          ) : (
            /* It opens the student login only (employers log in on /employers). */
            <Link className="btn btn-primary btn-sm" to="/login">{t('header.studentLogin')}</Link>
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
            {menuOpen ? t('common.close') : t('header.menu')}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="menu-panel" id="menu-panel" aria-label={t('header.mobileNav')}>
          <Link to="/jobs" aria-current={jobsCurrent ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{t('header.jobs')}</Link>
          {extra && (
            <Link to={extra.to} aria-current={extra.current ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
              {extra.text}
            </Link>
          )}
          <LangSwitch className="menu-lang" />
          {session && (
            <>
              <Link
                className="menu-user"
                to="/account"
                aria-label={t('header.accountLabel', { name: label })}
                aria-current={accountCurrent ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
              {/* Last in the menu, set apart from the links above it. */}
              <LogOutButton className="menu-logout" onError={setError} onDone={() => setMenuOpen(false)} />
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
