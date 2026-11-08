import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import ReportJob from '../components/ReportJob.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import { fetchProfile } from '../lib/auth.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import {
  CATEGORY_LABEL,
  ITALIAN_LABEL,
  isNew,
  metroLabel,
  JOB_TYPE_LABEL,
  dateLabel,
  fetchJob,
  hoursLabel,
  payLabel,
  placeLabel,
  postedLabel,
  revealContact,
  websiteHref,
  websiteText
} from '../lib/jobs.js';

export default function JobDetail() {
  return (
    <PageShell className="jobs-main">
      {supabase ? <JobPage /> : <ConfigError title="This job can't be shown right now" />}
    </PageShell>
  );
}

function BackLink() {
  return (
    <Link className="back" to="/jobs">
      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
      All jobs
    </Link>
  );
}

function JobPage() {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading', job: null });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', job: null });
    fetchJob(id)
      .then((job) => active && setState({ status: job ? 'ready' : 'missing', job }))
      .catch(() => active && setState({ status: 'error', job: null }));
    return () => {
      active = false;
    };
  }, [id, retry]);

  if (state.status === 'loading') return <p className="muted">Loading the job…</p>;
  if (state.status === 'error') {
    return (
      <div className="empty-state page-empty" role="alert">
        <BackLink />
        <p><strong>We couldn't load this job.</strong></p>
        <p className="muted">Check your connection and try again.</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRetry((n) => n + 1)}>Try again</button>
      </div>
    );
  }
  if (state.status === 'missing') {
    return (
      <div className="empty-state page-empty">
        <BackLink />
        <h1 className="page-title">This job isn't available</h1>
        <p className="muted">It may have been filled, closed or expired.</p>
        <Link className="btn btn-primary" to="/jobs">See all jobs</Link>
      </div>
    );
  }

  const job = state.job;
  const company = job.companies;
  const site = websiteHref(company.website);

  return (
    <>
      <BackLink />
      <div className="detail">
        <article>
          <h1 className="page-title">{job.title}</h1>
          <p className="detail-co"><Link to={`/companies/${company.id}`}>{company.name}</Link></p>
          <div className="tags">
            {isNew(job) && <span className="tag tag-new">New</span>}
            <span className="tag">{JOB_TYPE_LABEL[job.job_type]}</span>
            {job.category && job.category !== 'other' && <span className="tag">{CATEGORY_LABEL[job.category]}</span>}
            <span className={'tag' + (job.italian_level === 'none' ? ' tag-italian-none' : '')}>{ITALIAN_LABEL[job.italian_level]}</span>
            {job.remote && <span className="tag">Remote</span>}
          </div>
          <dl className="facts">
            <div><dt>Pay</dt><dd>{payLabel(job)}</dd></div>
            <div><dt>Hours</dt><dd className="tnum">{hoursLabel(job)}</dd></div>
            <div>
              <dt>Location</dt>
              <dd>
                {placeLabel(job)}
                {metroLabel(job) && <span className="metro-badge detail-metro">{metroLabel(job)}</span>}
              </dd>
            </div>
            <div><dt>Start</dt><dd>{job.start_date ? dateLabel(job.start_date) : 'Flexible'}</dd></div>
          </dl>
          <div className="prose-role">
            <h2>About the job</h2>
            {job.description ? (
              <p className="job-text">{job.description}</p>
            ) : (
              <p className="muted">The employer hasn't added a description yet.</p>
            )}
            <p className="muted job-posted">Posted {postedLabel(job.created_at).toLowerCase()}.</p>
            <h2>About {company.name}</h2>
            {company.description ? <p className="job-text">{company.description}</p> : null}
            {site ? (
              <p>
                <a href={site} target="_blank" rel="noopener noreferrer">{websiteText(company.website)}</a>
              </p>
            ) : null}
            {!company.description && !site ? <p className="muted">No company details yet.</p> : null}
            <p>
              <Link to={`/companies/${company.id}`}>All jobs from {company.name}</Link>
            </p>
          </div>
          <ReportJob jobId={job.id} />
        </article>
        <aside aria-label="How to apply">
          <div className="apply">
            <HowToApply jobId={job.id} jobTitle={job.title} />
          </div>
        </aside>
      </div>
    </>
  );
}

// The email students send from the "Apply" button.
function mailtoFor(email, title) {
  return `mailto:${email}?subject=${encodeURIComponent(`Application: ${title} (via GigoMe)`)}`;
}

function HowToApply({ jobId, jobTitle }) {
  const { session, loading } = useSession();
  const userId = session ? session.user.id : null;
  const [accountType, setAccountType] = useState(null);
  const [reveal, setReveal] = useState({ status: 'idle' });

  useEffect(() => {
    if (!userId) {
      setAccountType(null);
      return undefined;
    }
    let active = true;
    fetchProfile(userId)
      .then((p) => active && setAccountType((p && p.account_type) || 'student'))
      .catch(() => active && setAccountType('student')); // the database checks again anyway
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading || (userId && !accountType)) return <p className="muted">Loading…</p>;

  if (!session) {
    return (
      <>
        <Link className="btn btn-primary" to={`/login?next=${encodeURIComponent('/jobs/' + jobId)}`}>
          Log in to see how to apply
        </Link>
        <p className="apply-note">Log in with your university email to see how to apply.</p>
      </>
    );
  }

  if (accountType === 'company') {
    return <p className="apply-note apply-company">Only students can apply for jobs on GigoMe. You're logged in with a company account.</p>;
  }

  // Called only when the student presses "Apply": each call counts an apply
  // click. The new tab is opened right away, while the browser still treats
  // it as the student's click: a tab opened after waiting for the database is
  // blocked by Safari and most phones. It's pointed at the application page
  // once that's known, or closed again for an email-only job.
  async function onApply() {
    let tab = null;
    try {
      tab = window.open('', '_blank');
    } catch {
      tab = null;
    }
    if (tab) {
      try {
        tab.opener = null;
        tab.document.title = 'Opening…';
        tab.document.body.textContent = 'Opening the application page…';
      } catch {
        /* the tab still works without the message */
      }
    }
    setReveal({ status: 'busy' });
    const result = await revealContact(jobId);
    if (result.error) {
      if (tab) tab.close();
      setReveal({ status: 'error', message: result.error });
      return;
    }
    let opened = 'none';
    if (result.url) {
      if (tab) {
        tab.location.href = result.url;
        opened = 'tab';
      } else {
        window.open(result.url, '_blank', 'noopener,noreferrer');
        opened = 'maybe';
      }
    } else {
      if (tab) tab.close();
      if (result.email) {
        window.location.href = mailtoFor(result.email, jobTitle);
        opened = 'mail';
      }
    }
    setReveal({ status: 'done', ...result, opened });
  }

  if (reveal.status === 'done') {
    if (!reveal.url && !reveal.email) {
      return (
        <p className="apply-note">
          This employer hasn't added how to apply yet. Write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we'll pass your interest on.
        </p>
      );
    }
    return (
      <div className="apply-contact">
        <p className="apply-heading">How to apply</p>
        <p className="apply-note apply-opened" role="status">
          {reveal.url
            ? "The application page should have opened in a new tab. If it didn't, use the link below."
            : 'Your email app should have opened with the subject filled in. If it didn\'t, write to the address below.'}
        </p>
        {reveal.url && (
          <a className="btn btn-primary" href={reveal.url} target="_blank" rel="noopener noreferrer">
            Open the application page
          </a>
        )}
        {reveal.email && (
          <p>
            Email: <a className="apply-email" href={mailtoFor(reveal.email, jobTitle)}>{reveal.email}</a>
          </p>
        )}
        <p className="apply-note">Applications go straight to the employer.</p>
      </div>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={onApply} disabled={reveal.status === 'busy'}>
        {reveal.status === 'busy' ? 'Opening…' : 'Apply'}
      </button>
      {reveal.status === 'error' && <p className="err" role="alert">{reveal.message}</p>}
      <p className="apply-note">Applications go straight to the employer.</p>
    </>
  );
}
