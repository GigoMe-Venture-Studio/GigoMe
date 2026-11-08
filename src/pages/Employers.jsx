import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import CodeLogin from '../components/CodeLogin.jsx';
import { supabase } from '../lib/supabase.js';
import { logOut, safeNext } from '../lib/auth.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { useCompanyAccount } from '../lib/useCompanyAccount.js';

// /employers: what GigoMe is for companies, and the employer login.
export default function Employers() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  return (
    <PageShell className="employers-main">
      <div className="employers">
        <section className="employers-intro" aria-labelledby="employers-title">
          <h1 id="employers-title">Hire students in Milan who work in English</h1>
          <p className="lead">
            GigoMe is a job board for international students in Milan: part-time work, gigs and internships you can do
            in English.
          </p>
          <h2>Free to list jobs</h2>
          <p>Listing jobs on GigoMe is free. Students apply directly with you, on your website or by email.</p>
          <h2>How review works</h2>
          <ol className="employers-steps">
            <li>Log in with your work email and tell us about your company. We review it, usually within 2 working days.</li>
            <li>Write your jobs. You can prepare drafts while we review your company.</li>
            <li>
              Submit each job for review. We check that the role is real, pay and hours are stated, and nothing is asked
              of students up front. Then it goes live.
            </li>
          </ol>
          <p className="muted">
            Questions? Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
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
  if (account.status === 'loading') return <p className="auth-card muted">Loading…</p>;
  if (account.status === 'student') {
    return (
      <div className="auth-card">
        <h2 className="employers-login-title">You're logged in as a student</h2>
        <p className="lead">
          <strong className="auth-email">{email}</strong> is a student account. To list jobs, log out and log in here with
          your work email.
        </p>
        <LogOutButton />
      </div>
    );
  }
  const to = account.status === 'noCompany' ? '/employers/setup' : next || '/dashboard';
  return (
    <div className="auth-card">
      <h2 className="employers-login-title">You're logged in</h2>
      <p className="lead">
        Logged in as <strong className="auth-email">{email}</strong>.
      </p>
      <div className="auth-buttons">
        <Link className="btn btn-primary" to={to}>
          {account.status === 'noCompany' ? 'Set up your company' : 'Go to your dashboard'}
        </Link>
      </div>
    </div>
  );
}

function LogOutButton() {
  const [error, setError] = useState('');
  return (
    <div className="auth-buttons">
      <button type="button" className="btn btn-secondary" onClick={async () => setError((await logOut()) || '')}>
        Log out
      </button>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
