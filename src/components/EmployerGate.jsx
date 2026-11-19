import { Link, Navigate } from 'react-router';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { useT } from '../lib/useLang.js';

// What the employer pages show before the account is ready. Returns null when
// the page can render.
export default function EmployerGate({ account, here, allowNoCompany = false }) {
  const t = useT();
  const { status } = account;
  if (status === 'loading') return <p className="muted">{t('common.loading')}</p>;
  if (status === 'loggedOut') return <Navigate to={'/employers?next=' + encodeURIComponent(here)} replace />;
  if (status === 'error') {
    return <p className="err" role="alert">{t('employerGate.loadError')}</p>;
  }
  if (status === 'student') {
    return (
      <div className="auth-card">
        <h1>{t('employerGate.studentTitle')}</h1>
        <p className="lead">
          {t('employerGate.studentText', {
            link: (words) => <Link to="/employers">{words}</Link>,
            email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          })}
        </p>
      </div>
    );
  }
  if (status === 'noCompany' && !allowNoCompany) return <Navigate to="/employers/setup" replace />;
  return null;
}
