import { Link } from 'react-router';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { useOpenFeedback } from './Feedback.jsx';
import { useSession } from '../lib/useSession.js';
import { useT } from '../lib/useLang.js';

// The footer on every page (rendered once in App.jsx).
export default function SiteFooter() {
  const t = useT();
  const openFeedback = useOpenFeedback();
  const { session, loading } = useSession();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="brand">
          <Link className="wordmark" to="/">GigoMe</Link>
          <span className="muted">{t('footer.tagline')}</span>
        </div>
        <nav aria-label={t('footer.nav')}>
          {!session && !loading && <Link to="/employers">{t('header.forEmployers')}</Link>}
          <Link to="/how-it-works">{t('footer.howItWorks')}</Link>
          <Link to="/safety">{t('footer.safety')}</Link>
          <Link to="/privacy">{t('footer.privacy')}</Link>
          <Link to="/terms">{t('footer.terms')}</Link>
          <button type="button" className="footer-link-btn" onClick={openFeedback}>{t('footer.feedback')}</button>
        </nav>
        <p className="footer-help">
          {t('footer.help')} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>
    </footer>
  );
}
