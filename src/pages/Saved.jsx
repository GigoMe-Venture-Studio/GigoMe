import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import JobCard from '../components/JobCard.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import { fetchJobs } from '../lib/jobs.js';
import { fetchSavedList, setSaved, useSavedJobs } from '../lib/saved.js';

// /saved: a student's saved jobs. Live ones as job cards; ones that closed or
// expired as "No longer available", with a way to remove them.
export default function Saved() {
  return <PageShell className="jobs-main">{supabase ? <SavedPage /> : <ConfigError />}</PageShell>;
}

function SavedPage() {
  const { session, loading } = useSession();
  const saved = useSavedJobs();
  const [state, setState] = useState({ status: 'loading', rows: [], jobs: [] });

  useEffect(() => {
    if (!saved.canSave) return undefined;
    let active = true;
    (async () => {
      try {
        const rows = await fetchSavedList();
        const liveIds = rows.filter((r) => r.live).map((r) => r.job_id);
        const jobs = liveIds.length ? await fetchJobs({ ids: liveIds }) : [];
        if (active) setState({ status: 'ready', rows, jobs });
      } catch {
        if (active) setState({ status: 'error', rows: [], jobs: [] });
      }
    })();
    return () => {
      active = false;
    };
  }, [saved.canSave]);

  if (loading || (session && !saved.loaded)) return <p className="muted">Loading…</p>;
  if (!session) return <Navigate to={'/login?next=' + encodeURIComponent('/saved')} replace />;
  if (!saved.canSave) {
    return (
      <div className="empty-state page-empty">
        <h1 className="page-title">Saved jobs</h1>
        <p className="muted">Saving jobs is for student accounts.</p>
      </div>
    );
  }

  // Follow removals made on this page (or elsewhere) straight away.
  const rows = state.rows.filter((r) => saved.ids.has(r.job_id));
  const byId = new Map(state.jobs.map((j) => [j.id, j]));
  const live = rows.map((r) => byId.get(r.job_id)).filter(Boolean);
  const gone = rows.filter((r) => !byId.get(r.job_id));

  return (
    <>
      <h1 className="page-title">Saved jobs</h1>
      {state.status === 'loading' && <p className="muted jobs-lead">Loading your saved jobs…</p>}
      {state.status === 'error' && <p className="err" role="alert">We couldn't load your saved jobs. Check your connection and reload the page.</p>}
      {state.status === 'ready' && rows.length === 0 && (
        <div className="empty-state">
          <p><strong>No saved jobs yet.</strong></p>
          <p className="muted">Press the bookmark on a job to keep it here.</p>
          <Link className="btn btn-secondary btn-sm" to="/jobs">Browse jobs</Link>
        </div>
      )}
      {live.length > 0 && (
        <ul className="role-list job-list saved-list">
          {live.map((job) => <JobCard key={job.id} job={job} />)}
        </ul>
      )}
      {gone.length > 0 && (
        <section className="saved-gone" aria-labelledby="gone-title">
          <h2 className="section-title" id="gone-title">No longer available</h2>
          <ul className="saved-gone-list">
            {gone.map((r) => <GoneRow key={r.job_id} row={r} />)}
          </ul>
        </section>
      )}
    </>
  );
}

function GoneRow({ row }) {
  const [error, setError] = useState('');
  return (
    <li className="saved-gone-row">
      <div>
        <p className="role-title">{row.title}</p>
        <p className="role-co">{row.company_name} · <span className="muted">No longer available</span></p>
        {error && <p className="err" role="alert">{error}</p>}
      </div>
      <button type="button" className="btn btn-tertiary btn-sm" onClick={async () => setError((await setSaved(row.job_id, false)) || '')}
        aria-label={`Remove ${row.title} from saved jobs`}>
        Remove
      </button>
    </li>
  );
}
