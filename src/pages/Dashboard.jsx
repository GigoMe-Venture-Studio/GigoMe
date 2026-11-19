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
import { useT } from '../lib/useLang.js';
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
  extendJob,
  canExtend,
  EXTEND_GRACE_DAYS,
  expiresInLabel,
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
  const t = useT();
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
        <h2 id="company-title">{t('dashboard.yourCompany')}</h2>
        <StatusTag status={company.status} table={COMPANY_STATUS} />
      </div>
      <p className="dash-status-text">{COMPANY_STATUS[company.status].text}</p>
      {editing ? (
        <CompanyForm initial={company} identityLocked={locked} submitLabel={t('dashboard.saveChanges')} onSave={onSave} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <dl className="dash-facts">
            <div><dt>{t('dashboard.name')}</dt><dd>{company.name}</dd></div>
            <div><dt>{t('dashboard.website')}</dt><dd>{site ? <a href={site} target="_blank" rel="noopener noreferrer">{websiteText(company.website)}</a> : <span className="muted">{t('dashboard.websiteNone')}</span>}</dd></div>
          </dl>
          {locked && (
            <p className="field-hint locked-hint">
              {t('dashboard.changeThese', { email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> })}
            </p>
          )}
          <dl className="dash-facts">
            <div><dt>{t('dashboard.description')}</dt><dd>{company.description || <span className="muted">{t('dashboard.descriptionNone')}</span>}</dd></div>
            <div><dt>{t('dashboard.contactEmail')}</dt><dd className="auth-email">{company.contact_email}</dd></div>
            {company.status === 'approved' && <Followers />}
          </dl>
          {saved && <p className="dash-saved" role="status">{t('dashboard.saved')}</p>}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSaved(false); setEditing(true); }}>
            {locked ? t('dashboard.editLocked') : t('dashboard.editCompany')}
          </button>
        </>
      )}
    </section>
  );
}

function JobsSection({ company }) {
  const t = useT();
  const [state, setState] = useState({ status: 'loading', jobs: [], clicks: {} });
  const [version, setVersion] = useState(0);
  const [actionError, setActionError] = useState('');
  const [actionDone, setActionDone] = useState('');

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
    setActionDone('');
    if (kind === 'extend') {
      try {
        const until = await extendJob(job.id);
        setActionDone(t('dashboard.extended', { title: job.title, date: dateLabel(String(until).slice(0, 10)) }));
        setVersion((n) => n + 1);
      } catch (e) {
        // The database's own reason when it refuses (e.g. expired too long ago).
        setActionError(e && e.code === '42501' && e.message ? e.message : t('dashboard.extendError'));
      }
      return;
    }
    const question =
      kind === 'close'
        ? t('dashboard.confirmClose', { title: job.title })
        : t('dashboard.confirmDelete', { title: job.title });
    if (!window.confirm(question)) return;
    try {
      if (kind === 'close') await setJobStatus(job.id, 'closed');
      else await deleteDraft(job.id);
      setVersion((n) => n + 1);
    } catch {
      setActionError(kind === 'close' ? t('dashboard.closeError') : t('dashboard.deleteError'));
    }
  }

  return (
    <section className="dash-card" aria-labelledby="jobs-title">
      <div className="dash-card-head">
        <h2 id="jobs-title">{t('dashboard.yourJobs')}</h2>
        <Link className="btn btn-primary btn-sm" to="/dashboard/jobs/new">{t('dashboard.newJob')}</Link>
      </div>
      {company.status !== 'approved' && (
        <p className="dash-status-text">
          {company.status === 'pending'
            ? t('dashboard.pendingNote')
            : t('dashboard.notApprovedNote')}
        </p>
      )}
      {actionError && <p className="err" role="alert">{actionError}</p>}
      <p className="dash-action-done" role="status">{actionDone}</p>
      {state.status === 'loading' && <p className="muted">{t('dashboard.loadingJobs')}</p>}
      {state.status === 'error' && (
        <p className="err" role="alert">{t('dashboard.loadError')}</p>
      )}
      {state.status === 'ready' && state.jobs.length === 0 && (
        <p className="muted dash-empty">{t('dashboard.empty')}</p>
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
  const t = useT();
  const status = shownStatus(job);
  const live = status === 'published';
  const expiresIn = live ? expiresInLabel(job.expires_at) : null;
  const soon = expiresIn && new Date(job.expires_at).getTime() - Date.now() < 7 * 86400000;
  // Live, or expired at most 14 days ago: "Extend by 60 days". Expired longer
  // ago: edit it and submit it again for review.
  const extendable = canExtend(job);
  const lastExtendDay = dateLabel(new Date(new Date(job.expires_at).getTime() + EXTEND_GRACE_DAYS * 86400000).toISOString().slice(0, 10));
  return (
    <li className="dash-job">
      <div className="dash-job-main">
        <p className="dash-job-title">{job.title}</p>
        <p className="dash-job-meta">
          {JOB_TYPE_LABEL[job.job_type] || t('dashboard.chooseType')} · {t('job.hoursPerWeek', { hours: job.hours_per_week })}
          {(live || status === 'expired') && <> · {t('dashboard.until', { date: dateLabel(String(job.expires_at).slice(0, 10)) })}</>}
        </p>
        <p className="dash-job-status">
          <StatusTag status={status} table={JOB_STATUS} /> <span className="muted">{JOB_STATUS[status].text}</span>
        </p>
        {expiresIn && <p className={'dash-expiry' + (soon ? ' dash-expiry-soon' : '')}>{expiresIn}</p>}
        {status === 'expired' && extendable && (
          <p className="dash-expiry dash-expiry-soon">{t('dashboard.canStillExtend', { date: lastExtendDay })}</p>
        )}
        {status === 'expired' && !extendable && (
          <p className="dash-expiry dash-expiry-old">
            {t('dashboard.expiredLongAgo', { days: EXTEND_GRACE_DAYS })}
          </p>
        )}
        {live && clicks !== null && (
          <p className="dash-clicks">
            <strong className="tnum">{clicks}</strong> {t('dashboard.applyClicks', { count: clicks })}
          </p>
        )}
        {['changes_requested', 'rejected', 'closed'].includes(status) && job.review_note && (
          <div className="review-note">
            <p className="review-note-label">{t('dashboard.reviewNote')}</p>
            <p className="job-text">{job.review_note}</p>
          </div>
        )}
      </div>
      <div className="dash-job-actions">
        {status !== 'rejected' && (
          <Link className="btn btn-secondary btn-sm" to={`/dashboard/jobs/${job.id}/edit`} aria-label={t('dashboard.editAria', { title: job.title })}>
            {t('dashboard.edit')}
          </Link>
        )}
        {extendable && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAct(job, 'extend')}
            aria-label={t('dashboard.extendAria', { title: job.title })} title={t('dashboard.extendTitle')}>
            {t('dashboard.extend')}
          </button>
        )}
        {['pending', 'published', 'changes_requested', 'expired'].includes(status) && (
          <button type="button" className="btn btn-tertiary btn-sm" onClick={() => onAct(job, 'close')} aria-label={t('dashboard.closeAria', { title: job.title })}>
            {t('dashboard.close')}
          </button>
        )}
        {status === 'draft' && (
          <button type="button" className="btn btn-tertiary btn-sm" onClick={() => onAct(job, 'delete')} aria-label={t('dashboard.deleteAria', { title: job.title })}>
            {t('dashboard.delete')}
          </button>
        )}
      </div>
    </li>
  );
}

// How many students follow the company: a number only. GigoMe never shows
// companies who follows them.
function Followers() {
  const t = useT();
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
      <dt>{t('dashboard.followers')}</dt>
      <dd className="tnum">
        {count === null ? '…' : count < 0 ? <span className="muted">{t('dashboard.followersError')}</span> : t('dashboard.followersCount', { count })}
        <span className="field-hint dash-followers-hint">{t('dashboard.followersHint')}</span>
      </dd>
    </div>
  );
}
