import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { isJobPath } from '../lib/links.js';
import { useT } from '../lib/useLang.js';

// The confirmation shown once, right after signing up, so people know their
// account exists: students after /welcome's first save (StudentReady),
// company accounts after the company setup (CompanySubmitted). It lives only
// in the page's state: a later login or a reload never shows it again.
// Nothing here sends an email or promises one.

// The heading takes the focus (and the page starts at the top), so screen
// readers announce the confirmation instead of the form that disappeared.
function useHeadingFocus() {
  const ref = useRef(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (ref.current) ref.current.focus();
  }, []);
  return ref;
}

function NextLogin({ email, page }) {
  const t = useT();
  return (
    <div className="signup-done-login">
      <p>{t('signup.loggedInAs', { email: <strong className="auth-email">{email}</strong> })}</p>
      <p>{t('signup.nextTime', { page })}</p>
    </div>
  );
}

function AccountLink() {
  const t = useT();
  return (
    <p className="auth-small signup-done-account">
      <Link to="/account">{t('signup.accountLink')}</Link>
    </p>
  );
}

// next: the safe ?next= path the student came from (Save or Apply on a job
// sends them to /login?next=/jobs/<id>), or ''.
export function StudentReady({ firstName, email, next }) {
  const heading = useHeadingFocus();
  const t = useT();
  const fromJob = isJobPath(next);
  const elsewhere = next && !fromJob && next !== '/' ? next : '';
  return (
    <div className="auth-card signup-done">
      <h1 ref={heading} tabIndex={-1}>{t('signup.allSet', { name: firstName })}</h1>
      <p className="lead">{t('signup.ready')}</p>
      <NextLogin email={email} page={t('signup.pageLogin')} />
      <div className="auth-buttons">
        {fromJob && <Link className="btn btn-primary" to={next}>{t('signup.backToJob')}</Link>}
        {elsewhere && <Link className="btn btn-primary" to={elsewhere}>{t('signup.continue')}</Link>}
        <Link className={'btn ' + (fromJob || elsewhere ? 'btn-secondary' : 'btn-primary')} to="/jobs">{t('signup.browseJobs')}</Link>
        {!fromJob && !elsewhere && <Link className="btn btn-secondary" to="/jobs?view=map">{t('signup.seeMap')}</Link>}
      </div>
      <AccountLink />
    </div>
  );
}

// What happens next follows the review flow as it is: the company is
// pending until an admin approves it (usually within 2 working days, the
// same promise as /employers and the dashboard); drafts can be written meanwhile; jobs
// are submitted only once it's approved and each is reviewed too; nobody is
// emailed about it, the dashboard shows the status.
export function CompanySubmitted({ companyName, email }) {
  const heading = useHeadingFocus();
  const t = useT();
  return (
    <div className="auth-card signup-done">
      <h1 ref={heading} tabIndex={-1}>{t('signup.companyTitle')}</h1>
      <p className="lead">{t('signup.companyLead', { name: <span className="signup-done-name">{companyName}</span> })}</p>
      <h2 className="signup-done-h2">{t('signup.nextTitle')}</h2>
      <ul className="signup-done-steps">
        <li>{t('signup.step1')}</li>
        <li>{t('signup.step2')}</li>
        <li>{t('signup.step3')}</li>
      </ul>
      <NextLogin email={email} page={t('signup.pageEmployers')} />
      <div className="auth-buttons">
        <Link className="btn btn-primary" to="/dashboard">{t('signup.goDashboard')}</Link>
        <Link className="btn btn-secondary" to="/dashboard/jobs/new">{t('signup.writeDraft')}</Link>
      </div>
      <AccountLink />
    </div>
  );
}
