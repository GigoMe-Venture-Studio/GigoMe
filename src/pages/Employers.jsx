import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import CodeLogin from '../components/CodeLogin.jsx';
import { supabase } from '../lib/supabase.js';
import { safeNext } from '../lib/auth.js';
import LogOutButton from '../components/LogOutButton.jsx';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { useCompanyAccount } from '../lib/useCompanyAccount.js';
import { useT } from '../lib/useLang.js';

// /employers: what GigoMe is for companies, and the employer login.
export default function Employers() {
  const t = useT();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  return (
    <PageShell className="employers-main">
      <div className="employers">
        <section className="employers-intro" aria-labelledby="employers-title">
          <h1 id="employers-title">{t('employers.title')}</h1>
          <p className="lead">{t('employers.lead')}</p>
          <h2>{t('employers.freeTitle')}</h2>
          <p>{t('employers.freeText')}</p>
          <h2>{t('employers.reviewTitle')}</h2>
          <ol className="employers-steps">
            <li>{t('employers.step1')}</li>
            <li>{t('employers.step2')}</li>
            <li>{t('employers.step3')}</li>
          </ol>
          <p className="muted">
            {t('employers.questions', { email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> })}
          </p>
        </section>
        <div className="employers-login">
          {supabase ? <EmployerLogin next={next} /> : <ConfigError />}
        </div>
      </div>
    </PageShell>
  );
}

function EmployerLogin({ next }) {
  const account = useCompanyAccount();
  return (
    <CodeLogin
      audience="employer"
      next={next}
      loggedIn={(session) => <AlreadyIn account={account} email={session.user.email} next={next} />}
    />
  );
}

function AlreadyIn({ account, email, next }) {
  const t = useT();
  if (account.status === 'loading') return <p className="auth-card muted">{t('common.loading')}</p>;
  if (account.status === 'student') {
    return (
      <div className="auth-card">
        <h2 className="employers-login-title">{t('employers.studentTitle')}</h2>
        <p className="lead">
          {t('employers.studentText', {
            email: <strong className="auth-email">{email}</strong>,
            link: (words) => <Link to="/jobs">{words}</Link>
          })}
        </p>
        <LogOutArea />
      </div>
    );
  }
  const to = account.status === 'noCompany' ? '/employers/setup' : next || '/dashboard';
  return (
    <div className="auth-card">
      <h2 className="employers-login-title">{t('employers.loggedInTitle')}</h2>
      <p className="lead">
        {t('employers.loggedInAs', { email: <strong className="auth-email">{email}</strong> })}
      </p>
      <div className="auth-buttons">
        <Link className="btn btn-primary" to={to}>
          {account.status === 'noCompany' ? t('employers.setUpCompany') : t('employers.goToDashboard')}
        </Link>
      </div>
    </div>
  );
}

function LogOutArea() {
  const [error, setError] = useState('');
  return (
    <div className="auth-buttons">
      <LogOutButton className="btn btn-secondary" onError={setError} />
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
