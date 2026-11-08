import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import JobCard from '../components/JobCard.jsx';
import { supabase } from '../lib/supabase.js';
import { fetchCompany, fetchJobs, websiteHref, websiteText } from '../lib/jobs.js';

// The map is only downloaded when this company has jobs to put on it.
const JobsMap = lazy(() => import('../components/JobsMap.jsx'));
const isMappable = (j) => !j.remote && j.latitude != null && j.longitude != null;

// /companies/:id: an approved company's public page. Name, description,
// website and its open jobs. Never the contact email.
export default function Company() {
  return (
    <PageShell className="jobs-main">
      {supabase ? <CompanyPage /> : <ConfigError title="This page can't be shown right now" />}
    </PageShell>
  );
}

function CompanyPage() {
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

  if (state.status === 'loading') return <p className="muted">Loading…</p>;
  if (state.status === 'error') return <p className="err" role="alert">We couldn't load this company. Check your connection and reload the page.</p>;
  if (state.status === 'missing') {
    return (
      <div className="empty-state page-empty">
        <h1 className="page-title">This company isn't on GigoMe</h1>
        <p className="muted">It may not be approved yet, or the link is wrong.</p>
        <Link className="btn btn-primary" to="/jobs">See all jobs</Link>
      </div>
    );
  }
  const { company, jobs } = state;
  const site = websiteHref(company.website);
  return (
    <article className="company-page">
      <h1 className="page-title">{company.name}</h1>
      {company.description && <p className="job-text company-about">{company.description}</p>}
      {site && (
        <p className="company-site">
          <a href={site} target="_blank" rel="noopener noreferrer">{websiteText(company.website)}</a>
        </p>
      )}
      <h2 className="section-title company-jobs-title">
        {jobs.length ? `Open jobs (${jobs.length})` : 'Open jobs'}
      </h2>
      {jobs.length === 0 ? (
        <p className="muted">No open jobs right now.</p>
      ) : (
        <div className={'jobs-results' + (jobs.some(isMappable) ? ' company-with-map' : '')}>
          <ul className="role-list job-list">
            {jobs.map((job) => <JobCard key={job.id} job={job} />)}
          </ul>
          {jobs.some(isMappable) && (
            <div className="company-map">
              <Suspense fallback={<div className="jobs-map jobs-map-loading" role="status">Loading the map…</div>}>
                <JobsMap jobs={jobs} onOpenJob={(jobId) => navigate(`/jobs/${jobId}`)} label={`Map of ${company.name}'s jobs`} />
              </Suspense>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
