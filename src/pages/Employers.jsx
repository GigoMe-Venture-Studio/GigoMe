import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import CodeLogin from '../components/CodeLogin.jsx';
import { supabase } from '../lib/supabase.js';
import { safeNext } from '../lib/auth.js';
import LogOutButton from '../components/LogOutButton.jsx';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { useCompanyAccount } from '../lib/useCompanyAccount.js';
import { useSession } from '../lib/useSession.js';
import { useT } from '../lib/useLang.js';

// /employers: what GigoMe is for companies, and the employer login.
// Under 900px the login comes after the whole pitch, so a button under the
// lead jumps to it (JumpToLogin); from 900px they sit side by side and the
// button is hidden (employer.css).
export default function Employers() {
  const t = useT();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const login = useRef(null);
  return (
    <PageShell className="employers-main">
      <div className="employers">
        <section className="employers-intro" aria-labelledby="employers-title">
          <h1 id="employers-title">{t('employers.title')}</h1>
          <p className="lead">{t('employers.lead')}</p>
          {supabase && <JumpToLogin target={login} />}
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
        <div className="employers-login" id="employer-login" ref={login} tabIndex={-1}>
          {supabase ? <EmployerLogin next={next} /> : <ConfigError />}
        </div>
      </div>
    </PageShell>
  );
}

// "Log in or register your company": scrolls to the login and moves focus
// there (the card, not the email field, so no keyboard pops up over it). No
// URL change, so Back still leaves the page. Only for logged-out visitors:
// while the session loads it holds its place, invisible, so the page doesn't
// jump; logged in, the card says what to do instead.
function JumpToLogin({ target }) {
  const t = useT();
  const { session, loading } = useSession();
  if (session) return null;
  const jump = () => {
    const el = target.current;
    if (!el) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  };
  return (
    <p className={loading ? 'employers-jump is-pending' : 'employers-jump'} aria-hidden={loading || undefined}>
      <button type="button" className="btn btn-primary" onClick={jump} tabIndex={loading ? -1 : undefined}>
        {t('employers.jumpToLogin')}
      </button>
    </p>
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
