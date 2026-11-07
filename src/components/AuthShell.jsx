import { useEffect } from 'react';
import { Link } from 'react-router';
import { CONTACT_EMAIL } from '../lib/contact.js';

// Page frame for /login, /welcome and /privacy, using the site's own header
// and footer styles.
export default function AuthShell({ children }) {
  useEffect(() => {
    // The demo hides the header on its admin screen through body[data-page].
    document.body.dataset.page = 'auth';
  }, []);

  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <Link className="wordmark" to="/">GigoMe</Link>
        </div>
      </header>
      <main className="wrap auth-main">{children}</main>
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
