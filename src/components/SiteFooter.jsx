import { Link } from 'react-router';
import { CONTACT_EMAIL } from '../lib/contact.js';

// The footer on every page (rendered once in App.jsx).
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="brand">
          <Link className="wordmark" to="/">GigoMe</Link>
          <span className="muted">A non-profit student project in Milan</span>
        </div>
        <nav aria-label="Footer">
          <Link to="/about">About</Link>
          <Link to="/privacy">Privacy notice</Link>
        </nav>
        <p className="footer-help">
          Questions or need help? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>
    </footer>
  );
}
