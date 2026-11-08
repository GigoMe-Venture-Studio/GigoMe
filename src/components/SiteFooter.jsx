import { Link } from 'react-router';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { useOpenFeedback } from './Feedback.jsx';
import { useSession } from '../lib/useSession.js';

// The footer on every page (rendered once in App.jsx).
export default function SiteFooter() {
  const openFeedback = useOpenFeedback();
  const { session, loading } = useSession();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="brand">
          <Link className="wordmark" to="/">GigoMe</Link>
          <span className="muted">A student project in Milan. Free for students.</span>
        </div>
        <nav aria-label="Footer">
          {!session && !loading && <Link to="/employers">For employers</Link>}
          <Link to="/privacy">Privacy notice</Link>
          <Link to="/terms">Terms</Link>
          <button type="button" className="footer-link-btn" onClick={openFeedback}>Give feedback</button>
        </nav>
        <p className="footer-help">
          Questions or need help? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>
    </footer>
  );
}
