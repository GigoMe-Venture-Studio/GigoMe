import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { isJobPath } from '../lib/links.js';

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
  return (
    <div className="signup-done-login">
      <p>
        You're logged in as <strong className="auth-email">{email}</strong>.
      </p>
      <p>
        Next time, enter this email on {page} and we'll send you a new 6-digit code. There's no password.
      </p>
    </div>
  );
}

function AccountLink() {
  return (
    <p className="auth-small signup-done-account">
      <Link to="/account">Edit or delete your account</Link>
    </p>
  );
}

// next: the safe ?next= path the student came from (Save or Apply on a job
// sends them to /login?next=/jobs/<id>), or ''.
export function StudentReady({ firstName, email, next }) {
  const heading = useHeadingFocus();
  const fromJob = isJobPath(next);
  const elsewhere = next && !fromJob && next !== '/' ? next : '';
  return (
    <div className="auth-card signup-done">
      <h1 ref={heading} tabIndex={-1}>You're all set, {firstName}.</h1>
      <p className="lead">Your GigoMe account is ready.</p>
      <NextLogin email={email} page="the login page" />
      <div className="auth-buttons">
        {fromJob && <Link className="btn btn-primary" to={next}>Back to the job</Link>}
        {elsewhere && <Link className="btn btn-primary" to={elsewhere}>Continue</Link>}
        <Link className={'btn ' + (fromJob || elsewhere ? 'btn-secondary' : 'btn-primary')} to="/jobs">Browse jobs</Link>
        {!fromJob && !elsewhere && <Link className="btn btn-secondary" to="/jobs?view=map">See jobs on the map</Link>}
      </div>
      <AccountLink />
    </div>
  );
}

// What happens next follows the review flow as it is: the company is
// pending until an admin approves it; drafts can be written meanwhile; jobs
// are submitted only once it's approved and each is reviewed too; nobody is
// emailed about it, the dashboard shows the status.
export function CompanySubmitted({ companyName, email }) {
  const heading = useHeadingFocus();
  return (
    <div className="auth-card signup-done">
      <h1 ref={heading} tabIndex={-1}>Your company is submitted</h1>
      <p className="lead">
        <span className="signup-done-name">{companyName}</span> is now in review. GigoMe checks every company by hand
        before its jobs can go live.
      </p>
      <h2 className="signup-done-h2">What happens next</h2>
      <ul className="signup-done-steps">
        <li>You can already write your jobs. They stay drafts that only you can see.</li>
        <li>Once your company is approved, submit each job. Students see a job only after it has been reviewed too.</li>
        <li>Your dashboard shows your company's status. We don't send an email when it changes, so check there.</li>
      </ul>
      <NextLogin email={email} page="the For employers page" />
      <div className="auth-buttons">
        <Link className="btn btn-primary" to="/dashboard">Go to your dashboard</Link>
        <Link className="btn btn-secondary" to="/dashboard/jobs/new">Write a draft job</Link>
      </div>
      <AccountLink />
    </div>
  );
}
