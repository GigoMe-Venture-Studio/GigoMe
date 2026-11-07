import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import { fetchProfile } from '../lib/auth.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import {
  ITALIAN_LABEL,
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
      <div className="empty-state" role="alert">
        <BackLink />
        <p><strong>We couldn't load this job.</strong></p>
        <p className="muted">Check your connection and try again.</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRetry((n) => n + 1)}>Try again</button>
      </div>
    );
  }
  if (state.status === 'missing') {
    return (
      <div className="empty-state">
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
          <p className="detail-co">{company.name}</p>
          <div className="tags">
            <span className="tag">{JOB_TYPE_LABEL[job.job_type]}</span>
            <span className={'tag' + (job.italian_level === 'none' ? ' tag-italian-none' : '')}>{ITALIAN_LABEL[job.italian_level]}</span>
            {job.remote && <span className="tag">Remote</span>}
          </div>
          <dl className="facts">
            <div><dt>Pay</dt><dd>{payLabel(job)}</dd></div>
            <div><dt>Hours</dt><dd className="tnum">{hoursLabel(job)}</dd></div>
            <div><dt>Location</dt><dd>{placeLabel(job)}</dd></div>
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
          </div>
        </article>
        <aside aria-label="How to apply">
          <div className="apply">
            <HowToApply jobId={job.id} />
          </div>
        </aside>
      </div>
    </>
  );
}

function HowToApply({ jobId }) {
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

  // Called only when the student presses the button: each call counts a click.
  async function onReveal() {
    setReveal({ status: 'busy' });
    const result = await revealContact(jobId);
    setReveal(result.error ? { status: 'error', message: result.error } : { status: 'done', ...result });
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
        {reveal.url && (
          <a className="btn btn-primary" href={reveal.url} target="_blank" rel="noopener noreferrer">
            Apply on the employer's site
          </a>
        )}
        {reveal.email && (
          <p>
            Email: <a className="apply-email" href={`mailto:${reveal.email}`}>{reveal.email}</a>
          </p>
        )}
        <p className="apply-note">Applications go straight to the employer.</p>
      </div>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={onReveal} disabled={reveal.status === 'busy'}>
        {reveal.status === 'busy' ? 'Loading…' : 'How to apply'}
      </button>
      {reveal.status === 'error' && <p className="err" role="alert">{reveal.message}</p>}
      <p className="apply-note">Applications go straight to the employer.</p>
    </>
  );
}
