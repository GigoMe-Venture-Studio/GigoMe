import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import NotFound from './NotFound.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import { CATEGORY_LABEL, ITALIAN_LABEL, JOB_TYPE_LABEL, dateLabel, languageLabels, payLabel, payNote, placeLabel, scheduleLabels, websiteHref, websiteText } from '../lib/jobs.js';
import { JOB_STATUS, shownStatus } from '../lib/employer.js';
import { REPORT_REASON_LABEL } from '../lib/reports.js';
import {
  FEEDBACK_SHOWN,
  LOG_ACTION_LABEL,
  REVIEW_CHECKLIST,
  checkIsAdmin,
  fetchOpenReports,
  fetchPendingCompanies,
  fetchPendingJobs,
  fetchRecentDecisions,
  fetchRecentFeedback,
  fetchLiveJobsMissingInfo,
  missingInfo,
  resolveReport,
  reviewJob,
  setCompanyStatus,
  fetchStats
} from '../lib/admin.js';

// /admin: admins only. Everyone else (logged out included) gets the 404 page,
// and the database refuses them anyway.
export default function Admin() {
  const { session, loading } = useSession();
  const [admin, setAdmin] = useState(null);
  const userId = session ? session.user.id : null;

  useEffect(() => {
    if (loading) return undefined;
    if (!supabase || !userId) {
      setAdmin(false);
      return undefined;
    }
    let active = true;
    checkIsAdmin().then((yes) => active && setAdmin(yes));
    return () => {
      active = false;
    };
  }, [userId, loading]);

  if (admin === null) return <PageShell className="admin-main"><p className="muted">Loading…</p></PageShell>;
  if (!admin) return <NotFound />;
  return (
    <PageShell className="admin-main">
      <AdminPage />
    </PageShell>
  );
}

const when = (iso) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function AdminPage() {
  const [data, setData] = useState({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    // Feedback that fails to load doesn't stop the moderation queue.
    const feedback = fetchRecentFeedback().catch(() => null);
    Promise.all([fetchPendingCompanies(), fetchPendingJobs(), fetchOpenReports(), fetchRecentDecisions(), feedback, fetchLiveJobsMissingInfo()])
      .then(([companies, jobs, reports, log, fb, noArea]) =>
        active && setData({ status: 'ready', companies, jobs, reports, log, feedback: fb, noArea }))
      .catch(() => active && setData({ status: 'error' }));
    return () => {
      active = false;
    };
  }, [version]);

  if (data.status === 'loading') return <p className="muted">Loading the moderation queue…</p>;
  if (data.status === 'error') return <p className="err" role="alert">We couldn't load the moderation queue. Reload the page.</p>;

  return (
    <div className="admin">
      <h1 className="page-title">Moderation</h1>
      <AdminStats />
      <p className="admin-summary">
        <a href="#admin-companies">{data.companies.length} {data.companies.length === 1 ? 'company' : 'companies'}</a>,{' '}
        <a href="#admin-jobs">{data.jobs.length} {data.jobs.length === 1 ? 'job' : 'jobs'}</a> and{' '}
        <a href="#admin-reports">{data.reports.length} open {data.reports.length === 1 ? 'report' : 'reports'}</a> waiting.{' '}
        {data.noArea.length > 0 && (
          <><a href="#admin-no-area">{data.noArea.length} live {data.noArea.length === 1 ? 'job is' : 'jobs are'} missing an area, a schedule or structured pay</a>.{' '}</>
        )}
        <a href="#admin-feedback">Latest feedback</a>.
      </p>

      <section className="admin-section" id="admin-companies" aria-labelledby="companies-title">
        <h2 id="companies-title">Companies waiting for review</h2>
        {data.companies.length === 0 ? <p className="muted">None.</p> : (
          <ul className="admin-list">{data.companies.map((c) => <CompanyItem key={c.id} company={c} onDone={reload} />)}</ul>
        )}
      </section>

      <section className="admin-section" id="admin-jobs" aria-labelledby="jobs-title">
        <h2 id="jobs-title">Jobs waiting for review</h2>
        {data.jobs.length === 0 ? <p className="muted">None.</p> : (
          <ul className="admin-list">{data.jobs.map((j) => <JobItem key={j.id} job={j} onDone={reload} />)}</ul>
        )}
      </section>

      <section className="admin-section" id="admin-reports" aria-labelledby="reports-title">
        <h2 id="reports-title">Open reports</h2>
        {data.reports.length === 0 ? <p className="muted">None.</p> : (
          <ul className="admin-list">{data.reports.map((r) => <ReportItem key={r.id} report={r} onDone={reload} />)}</ul>
        )}
      </section>

      <section className="admin-section" id="admin-no-area" aria-labelledby="no-area-title">
        <h2 id="no-area-title">Live jobs missing an area, a schedule or structured pay</h2>
        {data.noArea.length === 0 ? <p className="muted">None.</p> : (
          <>
            <p className="muted">
              Published before these became required. Without an area a job isn't on the map or in area searches; without a
              schedule it doesn't match the "When" filter; without structured pay it doesn't match "Minimum pay". Ask the employer
              to add them (editing sends the job back for review).
            </p>
            <ul className="admin-log">
              {data.noArea.map((j) => (
                <li key={j.id}>
                  <span className="muted tnum">Created {when(j.created_at)}</span> · <strong>{j.title}</strong>, {j.companies.name} · no{' '}
                  {missingInfo(j).join(', no ')} ·{' '}
                  <Link to={`/jobs/${j.id}`}>open its page</Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="admin-section" id="admin-feedback" aria-labelledby="feedback-title">
        <h2 id="feedback-title">Feedback</h2>
        {data.feedback === null ? (
          <p className="err" role="alert">We couldn't load the feedback. Reload the page.</p>
        ) : data.feedback.length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <>
            <p className="muted">The newest {FEEDBACK_SHOWN} messages, newest first. Senders aren't shown.</p>
            <ul className="admin-feedback">
              {data.feedback.map((f) => (
                <li key={f.id}>
                  <p className="muted admin-item-meta">
                    <span className="tnum">{when(f.created_at)}</span>
                    {f.page ? <> · on <span className="admin-feedback-page">{f.page}</span></> : ''}
                  </p>
                  <p className="job-text">{f.message}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="admin-section" aria-labelledby="log-title">
        <h2 id="log-title">Recent decisions</h2>
        {data.log.length === 0 ? <p className="muted">None yet.</p> : (
          <ul className="admin-log">
            {data.log.map((e) => (
              <li key={e.id}>
                <span className="muted tnum">{when(e.created_at)}</span> · {(e.admin && e.admin.full_name) || 'An admin'} ·{' '}
                <strong>{LOG_ACTION_LABEL[e.action] || e.action}</strong>
                {e.jobs ? `: ${e.jobs.title}` : e.companies ? `: ${e.companies.name}` : ''}
                {e.note && <span className="admin-log-note">"{e.note}"</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Runs an admin action, shows its error, reloads the queue when done.
// Our numbers, read through admin_stats(). Weeks start on Monday (UTC). If
// they don't load, the moderation queue still works.
const STATS = [
  ['students', 'Students registered'],
  ['companies_approved', 'Companies approved'],
  ['companies_with_live_job', 'Companies with a live job'],
  ['live_jobs', 'Live jobs'],
  ['apply_clicks_this_week', 'Apply clicks this week'],
  ['students_clicked_this_week', 'Students who clicked this week']
];
function AdminStats() {
  const [stats, setStats] = useState(undefined);
  useEffect(() => {
    let active = true;
    fetchStats().then((s) => active && setStats(s)).catch(() => active && setStats(null));
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="admin-stats" aria-labelledby="stats-title">
      <h2 id="stats-title" className="sr-only">Numbers</h2>
      {stats === null ? (
        <p className="muted">The numbers couldn't be loaded.</p>
      ) : (
        <dl className="admin-stats-list">
          {STATS.map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd className="tnum">{stats === undefined ? '…' : Number(stats[key]) || 0}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="field-hint">Live jobs: published, not expired, approved company. Weeks start on Monday (UTC).</p>
    </section>
  );
}

function useAction(onDone) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function run(name, fn) {
    setBusy(name);
    setError('');
    try {
      await fn();
      setBusy('');
      onDone();
    } catch (e) {
      setBusy('');
      setError((e && e.message) || "That didn't work. Try again.");
    }
  }
  return { busy, error, setError, run };
}

function CompanyItem({ company, onDone }) {
  const { busy, error, run } = useAction(onDone);
  const site = websiteHref(company.website);
  return (
    <li className="admin-item">
      <p className="admin-item-title">{company.name}</p>
      <p className="muted admin-item-meta">Signed up {when(company.created_at)}</p>
      <dl className="dash-facts">
        <div><dt>Website</dt><dd>{site ? <a href={site} target="_blank" rel="noopener noreferrer">{websiteText(company.website)}</a> : <span className="muted">None given</span>}</dd></div>
        <div><dt>Description</dt><dd className="job-text">{company.description || <span className="muted">None given</span>}</dd></div>
        <div><dt>Contact email</dt><dd className="auth-email">{company.contact_email}</dd></div>
        <div><dt>Logs in with</dt><dd className="auth-email">{company.login_email}</dd></div>
      </dl>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="admin-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy)}
          onClick={() => run('approve', () => setCompanyStatus(company.id, 'approved'))}>
          {busy === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)}
          onClick={() => window.confirm(`Reject ${company.name}? Its jobs can't be submitted.`) && run('reject', () => setCompanyStatus(company.id, 'rejected'))}>
          {busy === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
    </li>
  );
}

function JobSummary({ job }) {
  const c = job.companies || {};
  return (
    <>
      <p className="admin-item-title">{job.title}</p>
      <p className="muted admin-item-meta">
        {c.name || 'Unknown company'} (company {c.status || 'unknown'}) · created {when(job.created_at)}
      </p>
      <dl className="dash-facts admin-job-facts">
        <div><dt>Type</dt><dd>{JOB_TYPE_LABEL[job.job_type]}{job.category ? `, ${CATEGORY_LABEL[job.category]}` : ''}</dd></div>
        <div><dt>Hours</dt><dd className="tnum">{job.hours_per_week} h/week{job.hours_per_week > 20 ? ' (over 20)' : ''}</dd></div>
        <div><dt>Pay</dt><dd>{job.pay_unit ? payLabel(job) : <span className="muted">Not structured{job.pay ? `: "${job.pay}"` : ''}</span>}{payNote(job) ? ` · ${payNote(job)}` : ''}</dd></div>
        <div><dt>Where</dt><dd>{placeLabel(job)}</dd></div>
        <div><dt>Area</dt><dd>{job.areas ? job.areas.name : <span className="muted">Not set</span>}{job.areas && (job.show_exact_location ? (job.latitude != null ? ', exact spot on the map' : ', no pin') : ', area only (private)')}</dd></div>
        <div><dt>Italian</dt><dd>{ITALIAN_LABEL[job.italian_level]}</dd></div>
        <div><dt>When</dt><dd>{scheduleLabels(job).join(', ') || <span className="muted">Not set</span>}</dd></div>
        <div><dt>Languages</dt><dd>{languageLabels(job).join(', ') || <span className="muted">Not stated</span>}</dd></div>
        <div><dt>Dates</dt><dd>{job.start_date ? `Starts ${dateLabel(job.start_date)}, ` : ''}shown until {dateLabel(String(job.expires_at).slice(0, 10))}</dd></div>
        <div><dt>How to apply</dt><dd className="auth-email">{[job.apply_url, job.apply_email].filter(Boolean).join(' · ') || <span className="muted">Nothing set</span>}</dd></div>
      </dl>
      <div className="admin-description">
        <p className="review-note-label">Description</p>
        <p className="job-text">{job.description || <span className="muted">None</span>}</p>
      </div>
    </>
  );
}

function JobItem({ job, onDone }) {
  const { busy, error, setError, run } = useAction(onDone);
  const [ticks, setTicks] = useState(() => REVIEW_CHECKLIST.map(() => false));
  const [note, setNote] = useState('');
  const allTicked = ticks.every(Boolean);
  const missing = missingInfo(job);

  function decide(status) {
    if ((status === 'changes_requested' || status === 'rejected') && !note.trim()) {
      setError('Write a note for the employer first: it is required to request changes or reject.');
      return;
    }
    if (status === 'rejected' && !window.confirm(`Reject "${job.title}"? The employer can't resubmit it.`)) return;
    run(status, () => reviewJob(job.id, status, status === 'published' ? null : note.trim()));
  }

  return (
    <li className="admin-item">
      <JobSummary job={job} />
      {job.review_note && <p className="muted admin-item-meta">Earlier note: "{job.review_note}"</p>}
      {missing.length > 0 && (
        <p className="admin-flag" role="note">
          <strong>No {missing.join(', no ')}.</strong> It can't be published without {missing.length > 1 ? 'them' : 'one'}. Request
          changes and ask the employer to add {missing.length > 1 ? 'them' : 'it'}.
        </p>
      )}
      <fieldset className="admin-checklist">
        <legend>Review checklist</legend>
        {REVIEW_CHECKLIST.map((item, i) => (
          <label key={item} className="check">
            <input type="checkbox" checked={ticks[i]} onChange={(e) => setTicks((t) => t.map((x, k) => (k === i ? e.target.checked : x)))} /> {item}
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span>Note for the employer <span className="field-optional">(required to request changes or reject)</span></span>
        <textarea className="input textarea" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="admin-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy) || !allTicked || missing.length > 0} onClick={() => decide('published')}
          aria-describedby={allTicked ? undefined : `checklist-hint-${job.id}`}>
          {busy === 'published' ? 'Publishing…' : 'Publish'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)} onClick={() => decide('changes_requested')}>
          {busy === 'changes_requested' ? 'Sending…' : 'Request changes'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)} onClick={() => decide('rejected')}>
          {busy === 'rejected' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
      {!allTicked && <p className="field-hint" id={`checklist-hint-${job.id}`}>Tick every item on the checklist to publish.</p>}
    </li>
  );
}

function ReportItem({ report, onDone }) {
  const { busy, error, setError, run } = useAction(onDone);
  const [note, setNote] = useState('');
  const job = report.jobs;
  const status = job ? shownStatus(job) : null;
  const reporter = report.reporter
    ? `${report.reporter.full_name || 'No name'} (${report.reporter.account_type === 'company' ? 'company account' : 'student'})`
    : 'A deleted account';

  function needNote(action) {
    if (!note.trim()) {
      setError(`Write a note first: it is required to ${action}.`);
      return false;
    }
    return true;
  }

  return (
    <li className="admin-item">
      <p className="admin-item-title">{REPORT_REASON_LABEL[report.reason]}</p>
      <p className="muted admin-item-meta">Reported {when(report.created_at)} by {reporter}</p>
      {report.details && <p className="job-text admin-report-details">{report.details}</p>}
      {job ? (
        <div className="admin-reported-job">
          <p className="review-note-label">
            The job ({JOB_STATUS[status].label}){status === 'published' && <> · <Link to={`/jobs/${job.id}`}>open its page</Link></>}
          </p>
          <JobSummary job={job} />
        </div>
      ) : (
        <p className="muted">The job no longer exists.</p>
      )}
      <label className="field">
        <span>Note <span className="field-optional">(required; the employer sees it if you unpublish)</span></span>
        <textarea className="input textarea" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="admin-actions">
        {job && job.status === 'published' && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)}
            onClick={() => needNote('unpublish the job') && window.confirm(`Unpublish "${job.title}"?`) && run('unpublish', () => reviewJob(job.id, 'closed', note.trim()))}>
            {busy === 'unpublish' ? 'Unpublishing…' : 'Unpublish the job'}
          </button>
        )}
        {job && job.companies && job.companies.status !== 'rejected' && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)}
            onClick={() =>
              window.confirm(
                `Reject ${job.companies.name}? All its jobs disappear from the site at once, and it can't submit new ones. ` +
                  'Use this for scams and payment demands, not just for one bad job.'
              ) && run('reject-company', () => setCompanyStatus(job.companies.id, 'rejected'))
            }>
            {busy === 'reject-company' ? 'Rejecting…' : 'Reject the company'}
          </button>
        )}
        <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy)}
          onClick={() => needNote('resolve the report') && run('resolve', () => resolveReport(report.id, note.trim()))}>
          {busy === 'resolve' ? 'Resolving…' : 'Resolve the report'}
        </button>
      </div>
      <p className="field-hint">
        Scam or payment demanded from students: reject the company, not just the job. Then resolve the report.
      </p>
    </li>
  );
}
