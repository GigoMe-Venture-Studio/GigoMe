import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import CompanyForm from '../components/CompanyForm.jsx';
import EmployerGate from '../components/EmployerGate.jsx';
import { supabase } from '../lib/supabase.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { announceProfileChange } from '../lib/profile.js';
import { useCompanyAccount } from '../lib/useCompanyAccount.js';
import { JOB_TYPE_LABEL, dateLabel, websiteHref, websiteText } from '../lib/jobs.js';
import {
  COMPANY_STATUS,
  JOB_STATUS,
  deleteDraft,
  fetchFollowerCount,
  fetchMyJobStats,
  fetchMyJobs,
  setJobStatus,
  shownStatus,
  updateCompany
} from '../lib/employer.js';

// /dashboard: a company account's company and jobs.
export default function Dashboard() {
  return <PageShell className="dashboard-main">{supabase ? <DashboardPage /> : <ConfigError />}</PageShell>;
}

function DashboardPage() {
  const account = useCompanyAccount();
  const location = useLocation();
  const navigate = useNavigate();
  // "Saved as a draft" / "submitted" from the job form: shown once, then
  // cleared so a reload doesn't show it again.
  const [flash] = useState(() => (location.state && location.state.flash) || '');
  useEffect(() => {
    if (location.state && location.state.flash) navigate('/dashboard', { replace: true, state: null });
  }, [location.state, navigate]);
  const gate = <EmployerGate account={account} here="/dashboard" />;
  if (account.status !== 'ready') return gate;
  const { company } = account;

  return (
    <div className="dashboard">
      <h1 className="page-title">{company.name}</h1>
      {flash && <p className="home-notice dash-flash" role="status">{flash}</p>}
      <CompanySection company={company} onSaved={account.setCompany} />
      <JobsSection company={company} />
    </div>
  );
}

function StatusTag({ status, table }) {
  return <span className={`status-tag status-${status}`}>{table[status].label}</span>;
}

function CompanySection({ company, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const site = websiteHref(company.website);
  // Once approved, only GigoMe changes the name and website.
  const locked = company.status === 'approved';

  async function onSave(fields) {
    const updated = await updateCompany(company.id, fields);
    onSaved(updated);
    announceProfileChange();
    setEditing(false);
    setSaved(true);
  }

  return (
    <section className="dash-card" aria-labelledby="company-title">
      <div className="dash-card-head">
        <h2 id="company-title">Your company</h2>
        <StatusTag status={company.status} table={COMPANY_STATUS} />
      </div>
      <p className="dash-status-text">{COMPANY_STATUS[company.status].text}</p>
      {editing ? (
        <CompanyForm initial={company} identityLocked={locked} submitLabel="Save changes" onSave={onSave} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <dl className="dash-facts">
            <div><dt>Name</dt><dd>{company.name}</dd></div>
            <div><dt>Website</dt><dd>{site ? <a href={site} target="_blank" rel="noopener noreferrer">{websiteText(company.website)}</a> : <span className="muted">Not added</span>}</dd></div>
          </dl>
          {locked && (
            <p className="field-hint locked-hint">
              To change these, write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          )}
          <dl className="dash-facts">
            <div><dt>Description</dt><dd>{company.description || <span className="muted">Not added</span>}</dd></div>
            <div><dt>Contact email</dt><dd className="auth-email">{company.contact_email}</dd></div>
            {company.status === 'approved' && <Followers />}
          </dl>
          {saved && <p className="dash-saved" role="status">Your company details are saved.</p>}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSaved(false); setEditing(true); }}>
            {locked ? 'Edit description and contact email' : 'Edit company details'}
          </button>
        </>
      )}
    </section>
  );
}

function JobsSection({ company }) {
  const [state, setState] = useState({ status: 'loading', jobs: [], clicks: {} });
  const [version, setVersion] = useState(0);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([fetchMyJobs(company.id), fetchMyJobStats().catch(() => null)])
      .then(([jobs, clicks]) => active && setState({ status: 'ready', jobs, clicks }))
      .catch(() => active && setState({ status: 'error', jobs: [], clicks: {} }));
    return () => {
      active = false;
    };
  }, [company.id, version]);

  async function act(job, kind) {
    setActionError('');
    const question =
      kind === 'close'
        ? `Close "${job.title}"? Students will no longer see it. You can edit it and submit it again later.`
        : `Delete the draft "${job.title}"? This can't be undone.`;
    if (!window.confirm(question)) return;
    try {
      if (kind === 'close') await setJobStatus(job.id, 'closed');
      else await deleteDraft(job.id);
      setVersion((n) => n + 1);
    } catch {
      setActionError(kind === 'close' ? "We couldn't close the job. Try again." : "We couldn't delete the draft. Try again.");
    }
  }

  return (
    <section className="dash-card" aria-labelledby="jobs-title">
      <div className="dash-card-head">
        <h2 id="jobs-title">Your jobs</h2>
        <Link className="btn btn-primary btn-sm" to="/dashboard/jobs/new">New job</Link>
      </div>
      {company.status !== 'approved' && (
        <p className="dash-status-text">
          {company.status === 'pending'
            ? 'You can prepare drafts now and submit them once your company is approved.'
            : 'Jobs can only be submitted by approved companies.'}
        </p>
      )}
      {actionError && <p className="err" role="alert">{actionError}</p>}
      {state.status === 'loading' && <p className="muted">Loading your jobs…</p>}
      {state.status === 'error' && (
        <p className="err" role="alert">We couldn't load your jobs. Check your connection and reload the page.</p>
      )}
      {state.status === 'ready' && state.jobs.length === 0 && (
        <p className="muted dash-empty">No jobs yet. Press "New job" to write your first one.</p>
      )}
      {state.status === 'ready' && state.jobs.length > 0 && (
        <ul className="dash-jobs">
          {state.jobs.map((job) => (
            <JobRow key={job.id} job={job} clicks={state.clicks ? state.clicks[job.id] || 0 : null} onAct={act} />
          ))}
        </ul>
      )}
    </section>
  );
}

function JobRow({ job, clicks, onAct }) {
  const status = shownStatus(job);
  const live = status === 'published';
  return (
    <li className="dash-job">
      <div className="dash-job-main">
        <p className="dash-job-title">{job.title}</p>
        <p className="dash-job-meta">
          {JOB_TYPE_LABEL[job.job_type]} · {job.hours_per_week} h/week
          {(live || status === 'expired') && <> · until {dateLabel(String(job.expires_at).slice(0, 10))}</>}
        </p>
        <p className="dash-job-status">
          <StatusTag status={status} table={JOB_STATUS} /> <span className="muted">{JOB_STATUS[status].text}</span>
        </p>
        {live && clicks !== null && (
          <p className="dash-clicks">
            <strong className="tnum">{clicks}</strong> {clicks === 1 ? 'apply click' : 'apply clicks'}
          </p>
        )}
        {['changes_requested', 'rejected', 'closed'].includes(status) && job.review_note && (
          <div className="review-note">
            <p className="review-note-label">Note from the reviewer</p>
            <p className="job-text">{job.review_note}</p>
          </div>
        )}
      </div>
      <div className="dash-job-actions">
        {status !== 'rejected' && (
          <Link className="btn btn-secondary btn-sm" to={`/dashboard/jobs/${job.id}/edit`} aria-label={`Edit ${job.title}`}>
            Edit
          </Link>
        )}
        {['pending', 'published', 'changes_requested', 'expired'].includes(status) && (
          <button type="button" className="btn btn-tertiary btn-sm" onClick={() => onAct(job, 'close')} aria-label={`Close ${job.title}`}>
            Close
          </button>
        )}
        {status === 'draft' && (
          <button type="button" className="btn btn-tertiary btn-sm" onClick={() => onAct(job, 'delete')} aria-label={`Delete ${job.title}`}>
            Delete
          </button>
        )}
      </div>
    </li>
  );
}

// How many students follow the company: a number only. GigoMe never shows
// companies who follows them.
function Followers() {
  const [count, setCount] = useState(null);
  useEffect(() => {
    let active = true;
    fetchFollowerCount().then((n) => active && setCount(n)).catch(() => active && setCount(-1));
    return () => {
      active = false;
    };
  }, []);
  return (
    <div>
      <dt>Followers</dt>
      <dd className="tnum">
        {count === null ? '…' : count < 0 ? <span className="muted">Couldn't load</span> : `${count} ${count === 1 ? 'student follows' : 'students follow'} your company`}
        <span className="field-hint dash-followers-hint">Students see your new jobs on their Saved jobs page. You see how many, never who.</span>
      </dd>
    </div>
  );
}
