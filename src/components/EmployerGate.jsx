import { Link, Navigate } from 'react-router';
import { CONTACT_EMAIL } from '../lib/contact.js';

// What the employer pages show before the account is ready. Returns null when
// the page can render.
export default function EmployerGate({ account, here, allowNoCompany = false }) {
  const { status } = account;
  if (status === 'loading') return <p className="muted">Loading…</p>;
  if (status === 'loggedOut') return <Navigate to={'/employers?next=' + encodeURIComponent(here)} replace />;
  if (status === 'error') {
    return <p className="err" role="alert">We couldn't load your company. Check your connection and reload the page.</p>;
  }
  if (status === 'student') {
    return (
      <div className="auth-card">
        <h1>This page is for employers</h1>
        <p className="lead">
          You're logged in with a student account. To list jobs for a company, log out and log in on the{' '}
          <Link to="/employers">employers page</Link> with your work email. Questions? Write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </div>
    );
  }
  if (status === 'noCompany' && !allowNoCompany) return <Navigate to="/employers/setup" replace />;
  return null;
}
