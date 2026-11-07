import { useEffect } from 'react';
import { Link } from 'react-router';
import { CONTACT_EMAIL } from '../lib/contact.js';

// Page frame for the React pages (login, jobs, privacy): the page content and
// the site's footer. The header is SiteHeader, shown on every page by App.jsx.
export default function PageShell({ children, className = 'auth-main' }) {
  useEffect(() => {
    // The demo hides the header on its admin screen through body[data-page].
    document.body.dataset.page = 'page';
  }, []);

  return (
    <>
      <main className={`wrap ${className}`}>{children}</main>
      <footer className="site-footer">
        <div className="wrap">
          <div className="brand">
            <Link className="wordmark" to="/">GigoMe</Link>
            <span className="muted">A non-profit student project in Milan</span>
          </div>
          <nav aria-label="Footer">
            <Link to="/privacy">Privacy notice</Link>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
