import JobText from '../components/JobText.jsx';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import NotFound from './NotFound.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import { labelMap, labelPairs, locale } from '../lib/i18n.js';
import { useT } from '../lib/useLang.js';
import ExampleTag from '../components/ExampleTag.jsx';
import AdminAccounts from '../components/AdminAccounts.jsx';
import { CATEGORY_LABEL, ITALIAN_LABEL, JOB_TYPE_LABEL, dateLabel, isExample, languageLabels, payLabel, payNote, placeLabel, scheduleLabels, websiteHref, websiteText } from '../lib/jobs.js';
import { JOB_STATUS, shownStatus } from '../lib/employer.js';
import { REPORT_REASON_LABEL } from '../lib/reports.js';
import {
  FEEDBACK_SHOWN,
  LOG_ACTION_LABEL,
  VERIFICATION_LABELS,
  companyChecks,
  reviewChecklist,
  checkIsAdmin,
  fetchOpenReports,
  fetchPendingCompanies,
  fetchPendingJobs,
  fetchRecentDecisions,
  fetchRecentFeedback,
  fetchLiveJobsMissingInfo,
  fetchStudentBreakdown,
  missingInfo,
  resolveReport,
  reviewJob,
  setCompanyStatus,
  fetchStats
} from '../lib/admin.js';

// /admin: admins only. Everyone else (logged out included) gets the 404 page,
// and the database refuses them anyway.
export default function Admin() {
  const t = useT();
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

  if (admin === null) return <PageShell className="admin-main"><p className="muted">{t('common.loading')}</p></PageShell>;
  if (!admin) return <NotFound />;
  return (
    <PageShell className="admin-main">
      <AdminPage />
    </PageShell>
  );
}

const when = (iso) =>
  new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// A company's status in the job summary ("company approved"); unknown values as they are.
const COMPANY_STATUS = labelMap('admin.companyStatus', ['pending', 'approved', 'rejected']);
// Table header scopes (HTML values, not words; the i18n check doesn't know the scope prop).
const COL = 'col';
const ROW = 'row';
const upperFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function AdminPage() {
  const t = useT();
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

  if (data.status === 'loading') return <p className="muted">{t('admin.loadingQueue')}</p>;
  if (data.status === 'error') return <p className="err" role="alert">{t('admin.queueError')}</p>;

  return (
    <div className="admin">
      <h1 className="page-title">{t('admin.title')}</h1>
      <AdminStats />
      <p className="admin-summary">
        {t('admin.summary', {
          companies: <a href="#admin-companies">{t('admin.summary.companies', { count: data.companies.length })}</a>,
          jobs: <a href="#admin-jobs">{t('admin.summary.jobs', { count: data.jobs.length })}</a>,
          reports: <a href="#admin-reports">{t('admin.summary.reports', { count: data.reports.length })}</a>
        })}{' '}
        {data.noArea.length > 0 && (
          <><a href="#admin-no-area">{t('admin.summary.missing', { count: data.noArea.length })}</a>.{' '}</>
        )}
        <a href="#admin-feedback">{t('admin.summary.feedback')}</a>.
      </p>

      <section className="admin-section" id="admin-companies" aria-labelledby="companies-title">
        <h2 id="companies-title">{t('admin.companies.title')}</h2>
        {data.companies.length === 0 ? <p className="muted">{t('admin.none')}</p> : (
          <ul className="admin-list">{data.companies.map((c) => <CompanyItem key={c.id} company={c} onDone={reload} />)}</ul>
        )}
      </section>

      <section className="admin-section" id="admin-jobs" aria-labelledby="jobs-title">
        <h2 id="jobs-title">{t('admin.jobs.title')}</h2>
        {data.jobs.length === 0 ? <p className="muted">{t('admin.none')}</p> : (
          <ul className="admin-list">{data.jobs.map((j) => <JobItem key={j.id} job={j} onDone={reload} />)}</ul>
        )}
      </section>

      <section className="admin-section" id="admin-reports" aria-labelledby="reports-title">
        <h2 id="reports-title">{t('admin.reports.title')}</h2>
        {data.reports.length === 0 ? <p className="muted">{t('admin.none')}</p> : (
          <ul className="admin-list">{data.reports.map((r) => <ReportItem key={r.id} report={r} onDone={reload} />)}</ul>
        )}
      </section>

      <section className="admin-section" id="admin-no-area" aria-labelledby="no-area-title">
        <h2 id="no-area-title">{t('admin.missing.title')}</h2>
        {data.noArea.length === 0 ? <p className="muted">{t('admin.none')}</p> : (
          <>
            <p className="muted">{t('admin.missing.text')}</p>
            <ul className="admin-log">
              {data.noArea.map((j) => (
                <li key={j.id}>
                  <span className="muted tnum">{t('admin.missing.created', { date: when(j.created_at) })}</span> · <strong>{j.title}</strong>, {j.companies.name} ·{' '}
                  {missingInfo(j).join(', ')} ·{' '}
                  <Link to={`/jobs/${j.id}`}>{t('admin.openPage')}</Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <AdminStudents />

      <AdminAccounts />

      <section className="admin-section" id="admin-feedback" aria-labelledby="feedback-title">
        <h2 id="feedback-title">{t('admin.feedback.title')}</h2>
        {data.feedback === null ? (
          <p className="err" role="alert">{t('admin.feedback.error')}</p>
        ) : data.feedback.length === 0 ? (
          <p className="muted">{t('admin.noneYet')}</p>
        ) : (
          <>
            <p className="muted">{t('admin.feedback.lead', { count: FEEDBACK_SHOWN })}</p>
            <ul className="admin-feedback">
              {data.feedback.map((f) => (
                <li key={f.id}>
                  <p className="muted admin-item-meta">
                    <span className="tnum">{when(f.created_at)}</span>
                    {f.page ? t('admin.feedback.on', { page: <span className="admin-feedback-page">{f.page}</span> }) : ''}
                  </p>
                  <p className="job-text">{f.message}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="admin-section" aria-labelledby="log-title">
        <h2 id="log-title">{t('admin.log.title')}</h2>
        {data.log.length === 0 ? <p className="muted">{t('admin.noneYet')}</p> : (
          <ul className="admin-log">
            {data.log.map((e) => (
              <li key={e.id}>
                <span className="muted tnum">{when(e.created_at)}</span> · {(e.admin && e.admin.full_name) || t('admin.log.anAdmin')} ·{' '}
                <strong>{LOG_ACTION_LABEL[e.action] || e.action}</strong>
                {e.jobs ? `: ${e.jobs.title}` : e.companies ? `: ${e.companies.name}` : ''}
                {((e.jobs && e.jobs.is_example) || (!e.jobs && e.companies && e.companies.is_example)) && <> <ExampleTag company={!e.jobs} /></>}
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
const STATS = labelPairs('admin.stats', [
  'students',
  'companies_approved',
  'companies_with_live_job',
  'live_jobs',
  'apply_clicks_this_week',
  'students_clicked_this_week'
]);
function AdminStats() {
  const t = useT();
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
      <h2 id="stats-title" className="sr-only">{t('admin.stats.title')}</h2>
      {stats === null ? (
        <p className="muted">{t('admin.stats.error')}</p>
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
      <p className="field-hint">{t('admin.stats.hint')}</p>
    </section>
  );
}

// Students by how they signed up (a listed university's email, or any email
// and "Which university?" on /welcome) and by university, and the names typed
// under "Other", so their student domains can be looked up and added (SUPABASE.md,
// "Universities"). Loaded on its own: if it fails, the queue still works.
function AdminStudents() {
  const t = useT();
  const [data, setData] = useState(undefined);
  useEffect(() => {
    let active = true;
    fetchStudentBreakdown().then((d) => active && setData(d)).catch(() => active && setData(null));
    return () => {
      active = false;
    };
  }, []);
  // 'Other' is the database's label for the names typed under "Other".
  const uniName = (u) => (u === null ? t('admin.students.notAnswered') : u === 'Other' ? t('admin.students.other') : u);
  return (
    <section className="admin-section admin-students" id="admin-students" aria-labelledby="students-title">
      <h2 id="students-title">{t('admin.students.title')}</h2>
      {data === undefined ? (
        <p className="muted">{t('common.loading')}</p>
      ) : data === null ? (
        <p className="err" role="alert">{t('admin.students.error')}</p>
      ) : data.rows.length === 0 ? (
        <p className="muted">{t('admin.students.none')}</p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <caption className="sr-only">{t('admin.students.caption')}</caption>
              <thead>
                <tr>
                  <th scope={COL}>{t('admin.students.university')}</th>
                  <th scope={COL}>{VERIFICATION_LABELS.university_email}</th>
                  <th scope={COL}>{VERIFICATION_LABELS.self_declared}</th>
                  <th scope={COL}>{t('admin.students.total')}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.university || ''}>
                    <th scope={ROW}>{uniName(r.university)}</th>
                    <td className="tnum">{r.university_email}</td>
                    <td className="tnum">{r.self_declared}</td>
                    <td className="tnum">{r.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope={ROW}>{t('admin.students.all')}</th>
                  <td className="tnum">{data.totals.university_email}</td>
                  <td className="tnum">{data.totals.self_declared}</td>
                  <td className="tnum">{data.totals.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="field-hint">{t('admin.students.hint')}</p>
          <h3 className="admin-subtitle">{t('admin.students.othersTitle')}</h3>
          {data.others.length === 0 ? (
            <p className="muted">{t('admin.noneYet')}</p>
          ) : (
            <>
              <ul className="admin-others">
                {data.others.map((o) => (
                  <li key={o.name}>
                    <span className="admin-other-name">{o.name}</span> <span className="muted tnum">{o.students}</span>
                  </li>
                ))}
              </ul>
              <p className="field-hint">{t('admin.students.othersHint')}</p>
            </>
          )}
        </>
      )}
    </section>
  );
}

function useAction(onDone) {
  const t = useT();
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
      setError((e && e.message) || t('admin.actionFailed'));
    }
  }
  return { busy, error, setError, run };
}

function CompanyItem({ company, onDone }) {
  const t = useT();
  const { busy, error, run } = useAction(onDone);
  const site = websiteHref(company.website);
  return (
    <li className="admin-item">
      <p className="admin-item-title">{company.name}</p>
      <p className="muted admin-item-meta">{t('admin.company.signedUp', { date: when(company.created_at) })}</p>
      <dl className="dash-facts">
        <div><dt>{t('admin.company.website')}</dt><dd>{site ? <a href={site} target="_blank" rel="noopener noreferrer">{websiteText(company.website)}</a> : <span className="muted">{t('admin.noneGiven')}</span>}</dd></div>
        <div><dt>{t('admin.description')}</dt><dd className="job-text">{company.description || <span className="muted">{t('admin.noneGiven')}</span>}</dd></div>
        <div><dt>{t('admin.company.contactEmail')}</dt><dd className="auth-email">{company.contact_email}</dd></div>
        <div><dt>{t('admin.company.loginEmail')}</dt><dd className="auth-email">{company.login_email}</dd></div>
      </dl>
      {/* What /how-it-works and /safety promise we check: a reminder, not a step. */}
      <div className="admin-promise">
        <p className="admin-promise-title">{t('admin.company.checkTitle')}</p>
        <ul>{companyChecks().map((c) => <li key={c}>{c}</li>)}</ul>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="admin-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy)}
          onClick={() => run('approve', () => setCompanyStatus(company.id, 'approved'))}>
          {busy === 'approve' ? t('admin.approving') : t('admin.approve')}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)}
          onClick={() => window.confirm(t('admin.company.confirmReject', { name: company.name })) && run('reject', () => setCompanyStatus(company.id, 'rejected'))}>
          {busy === 'reject' ? t('admin.rejecting') : t('admin.reject')}
        </button>
      </div>
    </li>
  );
}

function JobSummary({ job }) {
  const t = useT();
  const c = job.companies || {};
  const expires = dateLabel(String(job.expires_at).slice(0, 10));
  return (
    <>
      <p className="admin-item-title">{job.title}</p>
      <p className="muted admin-item-meta">
        {t('admin.job.meta', {
          company: c.name || t('admin.job.unknownCompany'),
          status: c.status ? COMPANY_STATUS[c.status] || c.status : t('admin.job.unknownStatus'),
          date: when(job.created_at)
        })}
      </p>
      <dl className="dash-facts admin-job-facts">
        <div><dt>{t('admin.job.type')}</dt><dd>{JOB_TYPE_LABEL[job.job_type] || job.job_type}{job.category ? `, ${CATEGORY_LABEL[job.category]}` : ''}</dd></div>
        <div><dt>{t('admin.job.hours')}</dt><dd className="tnum">{t('job.hoursPerWeek', { hours: job.hours_per_week })}{job.hours_per_week > 20 ? t('admin.job.over20') : ''}</dd></div>
        <div><dt>{t('admin.job.pay')}</dt><dd>{job.pay_unit ? payLabel(job) : <span className="muted">{job.pay ? t('admin.job.notStructuredNote', { note: job.pay }) : t('admin.job.notStructured')}</span>}{payNote(job) ? ` · ${payNote(job)}` : ''}</dd></div>
        <div><dt>{t('admin.job.where')}</dt><dd>{placeLabel(job)}</dd></div>
        <div><dt>{t('admin.job.area')}</dt><dd>{job.areas ? job.areas.name : <span className="muted">{t('admin.notSet')}</span>}{job.areas && (job.show_exact_location ? (job.latitude != null ? t('admin.job.exactSpot') : t('admin.job.noPin')) : t('admin.job.areaOnly'))}</dd></div>
        <div><dt>{t('admin.job.italian')}</dt><dd>{ITALIAN_LABEL[job.italian_level]}</dd></div>
        <div><dt>{t('admin.job.when')}</dt><dd>{scheduleLabels(job).join(', ') || <span className="muted">{t('admin.notSet')}</span>}</dd></div>
        <div><dt>{t('admin.job.languages')}</dt><dd>{languageLabels(job).join(', ') || <span className="muted">{t('admin.job.notStated')}</span>}</dd></div>
        <div><dt>{t('admin.job.dates')}</dt><dd>{job.start_date ? t('admin.job.datesStart', { start: dateLabel(job.start_date), end: expires }) : t('admin.job.datesNoStart', { end: expires })}</dd></div>
        <div><dt>{t('admin.job.howToApply')}</dt><dd className="auth-email">{[job.apply_url, job.apply_email].filter(Boolean).join(' · ') || <span className="muted">{t('admin.job.nothingSet')}</span>}</dd></div>
      </dl>
      <div className="admin-description">
        <p className="review-note-label">{t('admin.description')}</p>
        {job.description ? <JobText text={job.description} /> : <p className="muted">{t('admin.job.noDescription')}</p>}
      </div>
    </>
  );
}

function JobItem({ job, onDone }) {
  const t = useT();
  const { busy, error, setError, run } = useAction(onDone);
  const checklist = reviewChecklist();
  const [ticks, setTicks] = useState(() => checklist.map(() => false));
  const [note, setNote] = useState('');
  const allTicked = ticks.every(Boolean);
  const missing = missingInfo(job);

  function decide(status) {
    if ((status === 'changes_requested' || status === 'rejected') && !note.trim()) {
      setError(t('admin.job.noteFirst'));
      return;
    }
    if (status === 'rejected' && !window.confirm(t('admin.job.confirmReject', { title: job.title }))) return;
    run(status, () => reviewJob(job.id, status, status === 'published' ? null : note.trim()));
  }

  return (
    <li className="admin-item">
      <JobSummary job={job} />
      {job.review_note && <p className="muted admin-item-meta">{t('admin.job.earlierNote', { note: job.review_note })}</p>}
      {missing.length > 0 && (
        <p className="admin-flag" role="note">
          <strong>{upperFirst(missing.join(', '))}.</strong> {t('admin.job.missingFlag', { count: missing.length })}
        </p>
      )}
      <fieldset className="admin-checklist">
        <legend>{t('admin.job.checklist')}</legend>
        {checklist.map((item, i) => (
          <label key={item} className="check">
            <input type="checkbox" checked={ticks[i]} onChange={(e) => setTicks((x) => x.map((v, k) => (k === i ? e.target.checked : v)))} /> {item}
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span>{t('admin.job.noteLabel')} <span className="field-optional">{t('admin.job.noteHint')}</span></span>
        <textarea className="input textarea" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="admin-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy) || !allTicked || missing.length > 0} onClick={() => decide('published')}
          aria-describedby={allTicked ? undefined : `checklist-hint-${job.id}`}>
          {busy === 'published' ? t('admin.publishing') : t('admin.publish')}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)} onClick={() => decide('changes_requested')}>
          {busy === 'changes_requested' ? t('admin.sending') : t('admin.requestChanges')}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)} onClick={() => decide('rejected')}>
          {busy === 'rejected' ? t('admin.rejecting') : t('admin.reject')}
        </button>
      </div>
      {!allTicked && <p className="field-hint" id={`checklist-hint-${job.id}`}>{t('admin.job.tickAll')}</p>}
    </li>
  );
}

function ReportItem({ report, onDone }) {
  const t = useT();
  const { busy, error, setError, run } = useAction(onDone);
  const [note, setNote] = useState('');
  const job = report.jobs;
  const status = job ? shownStatus(job) : null;
  const reporter = report.reporter
    ? t('admin.report.reporter', {
      name: report.reporter.full_name || t('admin.report.noName'),
      kind: report.reporter.account_type === 'company' ? t('admin.report.companyAccount') : t('admin.report.student')
    })
    : t('admin.report.deletedAccount');

  function needNote(key) {
    if (!note.trim()) {
      setError(t(key));
      return false;
    }
    return true;
  }

  return (
    <li className="admin-item">
      <p className="admin-item-title">{REPORT_REASON_LABEL[report.reason]}</p>
      <p className="muted admin-item-meta">{t('admin.report.reported', { date: when(report.created_at), reporter })}</p>
      {report.details && <p className="job-text admin-report-details">{report.details}</p>}
      {job ? (
        <div className="admin-reported-job">
          <p className="review-note-label">
            {t('admin.report.theJob', { status: JOB_STATUS[status].label })}{isExample(job) && <> <ExampleTag /></>}{status === 'published' && <> · <Link to={`/jobs/${job.id}`}>{t('admin.openPage')}</Link></>}
          </p>
          <JobSummary job={job} />
        </div>
      ) : (
        // Deleted jobs keep only their title and company name in the report.
        <p className="muted">
          {!report.job_title
            ? t('admin.report.gone')
            : report.company_name
              ? t('admin.report.goneTitleCompany', { title: report.job_title, company: report.company_name })
              : t('admin.report.goneTitle', { title: report.job_title })}
        </p>
      )}
      <label className="field">
        <span>{t('admin.report.noteLabel')} <span className="field-optional">{t('admin.report.noteHint')}</span></span>
        <textarea className="input textarea" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="admin-actions">
        {job && job.status === 'published' && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)}
            onClick={() => needNote('admin.report.noteFirstUnpublish') && window.confirm(t('admin.report.confirmUnpublish', { title: job.title })) && run('unpublish', () => reviewJob(job.id, 'closed', note.trim()))}>
            {busy === 'unpublish' ? t('admin.report.unpublishing') : t('admin.report.unpublish')}
          </button>
        )}
        {job && job.companies && job.companies.status !== 'rejected' && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)}
            onClick={() =>
              window.confirm(t('admin.report.confirmRejectCompany', { name: job.companies.name }))
                && run('reject-company', () => setCompanyStatus(job.companies.id, 'rejected'))
            }>
            {busy === 'reject-company' ? t('admin.rejecting') : t('admin.report.rejectCompany')}
          </button>
        )}
        <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy)}
          onClick={() => needNote('admin.report.noteFirstResolve') && run('resolve', () => resolveReport(report.id, note.trim()))}>
          {busy === 'resolve' ? t('admin.report.resolving') : t('admin.report.resolve')}
        </button>
      </div>
      <p className="field-hint">{t('admin.report.hint')}</p>
    </li>
  );
}
