import JobText from '../components/JobText.jsx';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import JobCard from '../components/JobCard.jsx';
import ExampleTag from '../components/ExampleTag.jsx';
import { supabase } from '../lib/supabase.js';
import { fetchCompany, fetchJobs, websiteHref, websiteText } from '../lib/jobs.js';
import { shortText, usePageMeta } from '../lib/seo.js';
import { useSession } from '../lib/useSession.js';
import { useSavedJobs } from '../lib/saved.js';
import { isFollowing, setFollowing } from '../lib/student.js';
import { useT } from '../lib/useLang.js';

// The map is only downloaded when this company has jobs to put on it.
const JobsMap = lazy(() => import('../components/JobsMap.jsx'));
const isMappable = (j) => !j.remote && j.latitude != null && j.longitude != null;

// /companies/:id: an approved company's public page. Name, description,
// website and its open jobs. Never the contact email.
export default function Company() {
  const t = useT();
  return (
    <PageShell className="jobs-main">
      {supabase ? <CompanyPage /> : <ConfigError title={t('company.configError')} />}
    </PageShell>
  );
}

function CompanyPage() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', company: null, jobs: [] });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', company: null, jobs: [] });
    fetchCompany(id)
      .then(async (company) => {
        if (!company) return active && setState({ status: 'missing', company: null, jobs: [] });
        const jobs = await fetchJobs({ companyId: company.id });
        if (active) setState({ status: 'ready', company, jobs });
      })
      .catch(() => active && setState({ status: 'error', company: null, jobs: [] }));
    return () => {
      active = false;
    };
  }, [id]);

  // An example company (made up for testers) is never indexed.
  usePageMeta(
    state.status === 'ready'
      ? {
          title: t('company.metaTitle', { name: state.company.name }),
          description: shortText(t('company.metaDescription', { name: state.company.name, description: state.company.description || '' })),
          index: !state.company.is_example
        }
      : state.status === 'missing'
        ? { title: t('company.missingTitle'), index: false }
        : null
  );

  if (state.status === 'loading') return <p className="muted">{t('common.loading')}</p>;
  if (state.status === 'error') return <p className="err" role="alert">{t('company.loadError')}</p>;
  if (state.status === 'missing') {
    return (
      <div className="empty-state page-empty">
        <h1 className="page-title">{t('company.missingTitle')}</h1>
        <p className="muted">{t('company.missingText')}</p>
        <Link className="btn btn-primary" to="/jobs">{t('jobPage.seeAll')}</Link>
      </div>
    );
  }
  const { company, jobs } = state;
  const site = websiteHref(company.website);
  return (
    <article className="company-page">
      <div className="company-title-row">
        <h1 className="page-title">{company.name}</h1>
        <FollowButton company={company} />
      </div>
      {company.is_example && (
        <p className="company-example muted">
          <ExampleTag company /> {t('company.exampleNote')}
        </p>
      )}
      {company.description && <JobText text={company.description} className="company-about" />}
      {site && (
        <p className="company-site">
          <a href={site} target="_blank" rel="noopener noreferrer">{websiteText(company.website)}</a>
        </p>
      )}
      <h2 className="section-title company-jobs-title">
        {jobs.length ? t('company.openJobsCount', { count: jobs.length }) : t('company.openJobs')}
      </h2>
      {jobs.length === 0 ? (
        <p className="muted">{t('company.noJobs')}</p>
      ) : (
        <div className={'jobs-results' + (jobs.some(isMappable) ? ' company-with-map' : '')}>
          <ul className="role-list job-list">
            {jobs.map((job) => <JobCard key={job.id} job={job} />)}
          </ul>
          {jobs.some(isMappable) && (
            <div className="company-map">
              <Suspense fallback={<div className="jobs-map jobs-map-loading" role="status">{t('map.loading')}</div>}>
                <JobsMap jobs={jobs} onOpenJob={(jobId) => navigate(`/jobs/${jobId}`)} label={t('company.mapLabel', { name: company.name })} />
              </Suspense>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// "Follow": students see this company's new jobs on /saved. In the app only;
// the company sees how many students follow it, never who.
function FollowButton({ company }) {
  const t = useT();
  const { session, loading } = useSession();
  const { canSave, loaded } = useSavedJobs(); // students only
  const [state, setState] = useState({ status: 'loading', following: false, error: '' });
  useEffect(() => {
    if (!canSave) return undefined;
    let active = true;
    isFollowing(company.id)
      .then((following) => active && setState({ status: 'ready', following, error: '' }))
      .catch(() => active && setState({ status: 'ready', following: false, error: '' }));
    return () => {
      active = false;
    };
  }, [canSave, company.id]);

  if (loading || (session && !loaded)) return null;
  if (!session) {
    return (
      <Link className="btn btn-secondary btn-sm follow-btn" to={'/login?next=' + encodeURIComponent(`/companies/${company.id}`)}>
        {t('company.loginToFollow')}
      </Link>
    );
  }
  if (!canSave || state.status === 'loading') return null;
  async function toggle() {
    const next = !state.following;
    setState({ status: 'ready', following: next, error: '' });
    try {
      await setFollowing(company.id, next);
    } catch (e) {
      setState({ status: 'ready', following: !next,
        error: e && e.limit ? e.message : next ? t('company.followError') : t('company.unfollowError') });
    }
  }
  return (
    <div className="follow">
      <button type="button" className={'btn btn-sm follow-btn ' + (state.following ? 'btn-primary' : 'btn-secondary')}
        aria-pressed={state.following} onClick={toggle}>
        {state.following ? t('company.following') : t('company.follow')}
      </button>
      <p className="follow-note muted">{state.following ? t('company.followingNote') : t('company.followNote')}</p>
      {state.error && <p className="err" role="alert">{state.error}</p>}
    </div>
  );
}
