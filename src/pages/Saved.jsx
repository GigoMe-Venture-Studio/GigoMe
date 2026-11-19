import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import JobCard from '../components/JobCard.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import { useT } from '../lib/useLang.js';
import ExampleTag from '../components/ExampleTag.jsx';
import { fetchJobs, isExample, realFirst } from '../lib/jobs.js';
import { fetchAreas } from '../lib/areas.js';
import { fetchSavedList, setSaved, useSavedJobs } from '../lib/saved.js';
import {
  NEW_FROM_FOLLOWED_DAYS,
  deleteSearch,
  fetchFollows,
  fetchNewFromFollowed,
  fetchOpenedJobs,
  fetchSavedSearches,
  markSearchSeen,
  openedLabel,
  searchSummary,
  setFollowing
} from '../lib/student.js';

// /saved: what a student keeps for themselves. Saved jobs (live ones as job
// cards, closed or expired ones as "No longer available"), saved searches,
// new jobs from the companies they follow, and the jobs they opened. Only
// they can see any of it; nothing is emailed.
export default function Saved() {
  return <PageShell className="jobs-main">{supabase ? <SavedPage /> : <ConfigError />}</PageShell>;
}

function SavedPage() {
  const t = useT();
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

  if (loading || (session && !saved.loaded)) return <p className="muted">{t('common.loading')}</p>;
  if (!session) return <Navigate to={'/login?next=' + encodeURIComponent('/saved')} replace />;
  if (!saved.canSave) {
    return (
      <div className="empty-state page-empty">
        <h1 className="page-title">{t('header.savedJobs')}</h1>
        <p className="muted">{t('saved.studentsOnly')}</p>
      </div>
    );
  }

  // Follow removals made on this page (or elsewhere) straight away.
  const rows = state.rows.filter((r) => saved.ids.has(r.job_id));
  const byId = new Map(state.jobs.map((j) => [j.id, j]));
  // Newest saved first, real listings before example ones.
  const live = realFirst(rows.map((r) => byId.get(r.job_id)).filter(Boolean));
  const gone = realFirst(rows.filter((r) => !byId.get(r.job_id)));

  return (
    <>
      <h1 className="page-title">{t('header.savedJobs')}</h1>
      <p className="muted jobs-lead">{t('saved.lead')}</p>
      {state.status === 'loading' && <p className="muted saved-loading">{t('saved.loading')}</p>}
      {state.status === 'error' && <p className="err" role="alert">{t('saved.error')}</p>}
      {state.status === 'ready' && rows.length === 0 && (
        <div className="empty-state">
          <p><strong>{t('saved.empty')}</strong></p>
          <p className="muted">{t('saved.emptyHint')}</p>
          <Link className="btn btn-secondary btn-sm" to="/jobs">{t('saved.browse')}</Link>
        </div>
      )}
      {live.length > 0 && (
        <ul className="role-list job-list saved-list">
          {live.map((job) => <JobCard key={job.id} job={job} />)}
        </ul>
      )}
      {gone.length > 0 && (
        <section className="saved-gone" aria-labelledby="gone-title">
          <h2 className="section-title" id="gone-title">{t('saved.gone')}</h2>
          <ul className="saved-gone-list">
            {gone.map((r) => <GoneRow key={r.job_id} row={r} />)}
          </ul>
        </section>
      )}
      <SavedSearches />
      <Following />
      <Opened />
    </>
  );
}

function GoneRow({ row }) {
  const t = useT();
  const [error, setError] = useState('');
  return (
    <li className="saved-gone-row">
      <div>
        <p className="role-title">{row.title}</p>
        <p className="role-co">{row.company_name}{isExample(row) && <> <ExampleTag /></>} · <span className="muted">{t('saved.gone')}</span></p>
        {error && <p className="err" role="alert">{error}</p>}
      </div>
      <button type="button" className="btn btn-tertiary btn-sm" onClick={async () => setError((await setSaved(row.job_id, false)) || '')}
        aria-label={t('saved.removeLabel', { title: row.title })}>
        {t('saved.remove')}
      </button>
    </li>
  );
}

// Loads one section's data; status is loading, ready or error.
function useLoad(load) {
  const [state, setState] = useState({ status: 'loading', data: null });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    load()
      .then((data) => active && setState({ status: 'ready', data }))
      .catch(() => active && setState({ status: 'error', data: null }));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  return [state, () => setVersion((n) => n + 1)];
}

function SavedSearches() {
  const t = useT();
  const [areas, setAreas] = useState([]);
  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => setAreas([]));
  }, []);
  const [state, reload] = useLoad(fetchSavedSearches);
  const [error, setError] = useState('');
  return (
    <section className="saved-section" id="saved-searches" aria-labelledby="searches-title">
      <h2 className="section-title" id="searches-title">{t('saved.searches.title')}</h2>
      {state.status === 'loading' && <p className="muted">{t('common.loading')}</p>}
      {state.status === 'error' && <p className="err" role="alert">{t('saved.searches.error')}</p>}
      {state.status === 'ready' && state.data.length === 0 && (
        <p className="muted">{t('saved.searches.none', { link: (s) => <Link to="/jobs">{s}</Link> })}</p>
      )}
      {error && <p className="err" role="alert">{error}</p>}
      {state.status === 'ready' && state.data.length > 0 && (
        <ul className="saved-rows">
          {state.data.map((s) => (
            <li key={s.id} className="saved-row">
              <div>
                <Link className="saved-row-title" to={`/jobs?${s.params}`} onClick={() => markSearchSeen(s.id)}>{s.name}</Link>
                <p className="muted saved-row-meta">{searchSummary(s.filters, areas)}</p>
                <p className="saved-row-new">
                  {s.newCount == null
                    ? <span className="muted">{t('saved.searches.countFailed')}</span>
                    : s.newCount > 0
                      ? <span className="tag tag-new">{t('saved.searches.new', { count: s.newCount })}</span>
                      : <span className="muted">{t('saved.searches.nothingNew')}</span>}
                </p>
              </div>
              <button type="button" className="btn btn-tertiary btn-sm" aria-label={t('saved.searches.deleteLabel', { name: s.name })}
                onClick={async () => {
                  setError('');
                  try {
                    await deleteSearch(s.id);
                    reload();
                  } catch {
                    setError(t('saved.searches.deleteFailed'));
                  }
                }}>
                {t('saved.searches.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Following() {
  const t = useT();
  const [state, reload] = useLoad(async () => {
    const follows = await fetchFollows();
    const visible = follows.filter((f) => f.companies);
    const jobs = await fetchNewFromFollowed(visible.map((f) => f.company_id));
    return { follows: visible, jobs };
  });
  const [error, setError] = useState('');
  return (
    <section className="saved-section" id="following" aria-labelledby="following-title">
      <h2 className="section-title" id="following-title">{t('saved.following.title')}</h2>
      {state.status === 'loading' && <p className="muted">{t('common.loading')}</p>}
      {state.status === 'error' && <p className="err" role="alert">{t('saved.following.error')}</p>}
      {state.status === 'ready' && state.data.follows.length === 0 && (
        <p className="muted">{t('saved.following.none')}</p>
      )}
      {state.status === 'ready' && state.data.follows.length > 0 && (
        <>
          {state.data.jobs.length === 0 ? (
            <p className="muted">{t('saved.following.noNew', { days: NEW_FROM_FOLLOWED_DAYS })}</p>
          ) : (
            <ul className="role-list job-list">
              {state.data.jobs.map((job) => <JobCard key={job.id} job={job} />)}
            </ul>
          )}
          <h3 className="saved-subtitle">{t('saved.following.companies')}</h3>
          {error && <p className="err" role="alert">{error}</p>}
          <ul className="saved-rows">
            {state.data.follows.map((f) => (
              <li key={f.company_id} className="saved-row">
                <div>
                  <Link className="saved-row-title" to={`/companies/${f.company_id}`}>{f.companies.name}</Link>
                  {f.companies.is_example && <> <ExampleTag company /></>}
                </div>
                <button type="button" className="btn btn-tertiary btn-sm" aria-label={t('saved.following.unfollowLabel', { name: f.companies.name })}
                  onClick={async () => {
                    setError('');
                    try {
                      await setFollowing(f.company_id, false);
                      reload();
                    } catch {
                      setError(t('saved.following.unfollowFailed'));
                    }
                  }}>
                  {t('saved.following.unfollow')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Opened() {
  const t = useT();
  const [state] = useLoad(fetchOpenedJobs);
  return (
    <section className="saved-section" id="opened" aria-labelledby="opened-title">
      <h2 className="section-title" id="opened-title">{t('saved.opened.title')}</h2>
      <p className="muted saved-section-note">{t('saved.opened.note')}</p>
      {state.status === 'loading' && <p className="muted">{t('common.loading')}</p>}
      {state.status === 'error' && <p className="err" role="alert">{t('saved.opened.error')}</p>}
      {state.status === 'ready' && state.data.length === 0 && <p className="muted">{t('saved.opened.none')}</p>}
      {state.status === 'ready' && state.data.length > 0 && (
        <ul className="saved-rows">
          {state.data.map((r) => (
            <li key={r.job_id} className="saved-row">
              <div>
                {r.live ? (
                  <Link className="saved-row-title" to={`/jobs/${r.job_id}`}>{r.title}</Link>
                ) : (
                  <span className="saved-row-title">{r.title}</span>
                )}
                <p className="muted saved-row-meta">
                  {r.company_name}{r.live ? '' : ` · ${t('saved.gone')}`}
                </p>
                <p className="saved-row-meta">{openedLabel(r.last_opened_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
