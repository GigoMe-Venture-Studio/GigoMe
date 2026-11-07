import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import JobCard from '../components/JobCard.jsx';
import ConfigError from '../components/ConfigError.jsx';
import { supabase } from '../lib/supabase.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import {
  JOB_TYPES,
  MAX_HOURS_OPTIONS,
  cleanKeyword,
  fetchJobs,
  filtersToParams,
  hasFilters,
  readFilters
} from '../lib/jobs.js';

export default function Jobs() {
  return (
    <PageShell className="jobs-main">
      {supabase ? <JobBoard /> : <ConfigError title="Jobs can't be shown right now" />}
    </PageShell>
  );
}

function JobBoard() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const key = JSON.stringify(filters);
  const [state, setState] = useState({ status: 'loading', jobs: [] });
  const [retry, setRetry] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    // Only the newest request may update the list, so quick filter changes
    // can't show stale results.
    const request = ++latest.current;
    setState((s) => ({ status: 'loading', jobs: s.jobs }));
    fetchJobs(JSON.parse(key))
      .then((jobs) => request === latest.current && setState({ status: 'ready', jobs }))
      .catch(() => request === latest.current && setState({ status: 'error', jobs: [] }));
  }, [key, retry]);

  function setFilter(name, value) {
    setParams(filtersToParams({ ...filters, [name]: value }), { replace: true });
  }

  // The keyword updates the list 300 ms after typing stops (Enter applies it
  // at once). Typed text is kept as it is unless the URL changes elsewhere
  // (Clear filters, back button), so a trailing space isn't eaten mid-word.
  const [keyword, setKeyword] = useState(filters.q);
  useEffect(() => {
    setKeyword((typed) => (cleanKeyword(typed) === filters.q ? typed : filters.q));
  }, [filters.q]);
  useEffect(() => {
    const clean = cleanKeyword(keyword);
    if (clean === filters.q) return undefined;
    const timer = setTimeout(() => setFilter('q', clean), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);
  function clearFilters() {
    setParams({}, { replace: true });
  }

  const filtered = hasFilters(filters);
  const { status, jobs } = state;

  return (
    <>
      <h1 className="page-title">Jobs in Milan</h1>
      <p className="muted jobs-lead">Part-time work, gigs and internships for students, in English.</p>

      <form
        className="job-filters"
        aria-label="Filter jobs"
        onSubmit={(e) => {
          e.preventDefault();
          setFilter('q', cleanKeyword(keyword));
        }}
      >
        <label className="field job-keyword">
          Keyword
          <input
            className="input"
            type="search"
            name="q"
            placeholder="e.g. barista, tutor, marketing"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            enterKeyHint="search"
          />
        </label>
        <label className="field">
          Type of job
          <select className="select" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
            <option value="">Any type</option>
            {JOB_TYPES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Italian
          <select className="select" value={filters.italian} onChange={(e) => setFilter('italian', e.target.value)}>
            <option value="">Any level</option>
            <option value="none">No Italian needed</option>
            <option value="basic">Basic Italian at most</option>
          </select>
        </label>
        <label className="field">
          Remote
          <select className="select" value={filters.remote} onChange={(e) => setFilter('remote', e.target.value)}>
            <option value="">Remote or on site</option>
            <option value="yes">Remote</option>
            <option value="no">On site</option>
          </select>
        </label>
        <label className="field">
          Hours per week
          <select className="select" value={filters.hours} onChange={(e) => setFilter('hours', e.target.value)}>
            <option value="">Any hours</option>
            {MAX_HOURS_OPTIONS.map((h) => (
              <option key={h} value={String(h)}>Up to {h} hours</option>
            ))}
          </select>
        </label>
      </form>

      <div className="jobs-status">
        <span className="muted tnum" aria-live="polite">
          {status === 'ready' ? `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}` : status === 'loading' ? 'Loading jobs…' : ''}
        </span>
        {filtered && (
          <button type="button" className="btn-link" onClick={clearFilters}>Clear filters</button>
        )}
      </div>

      {status === 'error' && (
        <div className="empty-state" role="alert">
          <p><strong>We couldn't load the jobs.</strong></p>
          <p className="muted">Check your connection and try again.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      )}

      {status === 'ready' && jobs.length === 0 && !filtered && (
        <div className="empty-state">
          <p><strong>No jobs yet.</strong></p>
          <p className="muted">
            New jobs are added as employers join GigoMe, so check back soon. Know a business that's hiring? Tell us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </div>
      )}

      {status === 'ready' && jobs.length === 0 && filtered && (
        <div className="empty-state">
          <p><strong>No jobs match these filters.</strong></p>
          <p className="muted">Try a different type, more hours or a different Italian level.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear filters</button>
        </div>
      )}

      {jobs.length > 0 && status !== 'error' && (
        <ul className={'role-list job-list' + (status === 'loading' ? ' is-loading' : '')}>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </ul>
      )}
    </>
  );
}
