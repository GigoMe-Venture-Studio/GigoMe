import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import JobCard from '../components/JobCard.jsx';
import ConfigError from '../components/ConfigError.jsx';
import { supabase } from '../lib/supabase.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { fetchAreas } from '../lib/areas.js';
import { distanceLabel, inBounds, inLimits, mapParam, metresBetween, readMapParam } from '../lib/geo.js';
import { useSavedJobs } from '../lib/saved.js';
import { saveSearch, searchParamsText, searchSummary } from '../lib/student.js';
import {
  CATEGORIES,
  JOB_TYPES,
  LANGUAGES,
  MAX_HOURS_OPTIONS,
  MAX_MIN_PAY,
  SCHEDULES,
  cleanKeyword,
  fetchHiddenByPay,
  fetchJobs,
  filtersToParams,
  hasFilters,
  hiddenKinds,
  readFilters,
  realFirst
} from '../lib/jobs.js';

// MapLibre is only downloaded when the map is shown.
const JobsMap = lazy(() => import('../components/JobsMap.jsx'));
const isMappable = (j) => !j.remote && j.latitude != null && j.longitude != null;
const FOLDED_FILTERS = ['area', 'category', 'type', 'italian', 'remote', 'hours', 'when', 'lang', 'minpay'];
const DESKTOP = '(min-width: 900px)'; // list and map side by side

function useMedia(query) {
  const get = () => typeof window !== 'undefined' && Boolean(window.matchMedia) && window.matchMedia(query).matches;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export default function Jobs() {
  return (
    <PageShell className="jobs-main">
      {supabase ? <JobBoard /> : <ConfigError title="Jobs can't be shown right now" />}
    </PageShell>
  );
}

function JobBoard() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = readFilters(params);
  // List or map: in the URL too, but not a filter.
  const view = params.get('view') === 'map' ? 'map' : 'list';
  // The map position (?map=zoom/lat/lng) is kept with the view, so a map
  // view can be shared.
  const withView = (p, v = view) => {
    const out = v === 'map' ? { ...p, view: 'map' } : { ...p };
    if (params.get('map')) out.map = params.get('map');
    return out;
  };
  const [areas, setAreas] = useState([]);
  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => setAreas([]));
  }, []);
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
    setParams(withView(filtersToParams({ ...filters, [name]: value })), { replace: true });
  }
  function setView(next) {
    setParams(withView(filtersToParams(filters), next), { replace: true });
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
    setBox(null);
    setParams(withView({}), { replace: true });
  }

  const filtered = hasFilters(filters);
  // On phones the filters other than the keyword are folded behind "Filters",
  // so the first job shows without scrolling. The button shows how many of
  // them are set.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const folded = FOLDED_FILTERS.filter((name) => (Array.isArray(filters[name]) ? filters[name].length : filters[name])).length;
  const toggleIn = (name, value) =>
    setFilter(name, filters[name].includes(value) ? filters[name].filter((x) => x !== value) : [...filters[name], value]);
  const { status, jobs } = state;

  // "Minimum pay" hides every job without an hourly equivalent (paid per
  // project, unpaid, pay not specified): say how many and why, with a way back.
  const [hidden, setHidden] = useState(null);
  useEffect(() => {
    if (!filters.minpay || filters.nohourly) {
      setHidden(null);
      return undefined;
    }
    let active = true;
    fetchHiddenByPay(JSON.parse(key)).then((h) => active && setHidden(h)).catch(() => active && setHidden(null));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const { canSave } = useSavedJobs(); // students only

  // ---- The map: where it looks, and searching the area it shows.
  const desktop = useMedia(DESKTOP);
  // Where the map starts: the shared position in the URL, if any, read once.
  const [startView] = useState(() => readMapParam(params.get('map')));
  // Once the person has chosen a view (a shared link, or moving the map),
  // changing filters no longer moves the map.
  const [kept, setKept] = useState(Boolean(startView));
  // Desktop: "Search as I move the map" (on by default) keeps the list to the
  // jobs inside the map. Phones: "Search this area" does it once, on request.
  const [follow, setFollow] = useState(true);
  const [box, setBox] = useState(null); // [west, south, east, north] the list is limited to
  const lastBounds = useRef(null);
  const [movedSinceSearch, setMovedSinceSearch] = useState(false);

  // ---- "Use my location": only in this tab's memory. Never put in the URL,
  // never stored, never sent to GigoMe or anyone else.
  const [you, setYou] = useState(null); // [lng, lat]
  const [loc, setLoc] = useState('off'); // off | asking | on | denied | error | unavailable
  const [byDistance, setByDistance] = useState(false);
  function locate() {
    if (!navigator.geolocation) {
      setLoc('unavailable');
      return;
    }
    setLoc('asking');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setYou([p.coords.longitude, p.coords.latitude]);
        setLoc('on');
        setKept(true);
      },
      (e) => setLoc(e && e.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  }
  function forgetLocation() {
    setYou(null);
    setByDistance(false);
    setLoc('off');
  }

  function onViewChange(v) {
    lastBounds.current = v.bounds;
    if (v.byUser) {
      setKept(true);
      setMovedSinceSearch(true);
    }
    if (desktop && follow) setBox(v.bounds);
    // Keep the position in the URL, except while "You are here" is shown:
    // the map is then centred on the person, and that mustn't be saved.
    if (!you && (v.byUser || params.get('map'))) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('map', mapParam(v));
          return next;
        },
        { replace: true }
      );
    }
  }
  function searchThisArea() {
    if (lastBounds.current) setBox(lastBounds.current);
    setMovedSinceSearch(false);
  }
  // Desktop: following the map applies only while the map is shown and the
  // option is on.
  useEffect(() => {
    if (desktop && (view !== 'map' || !follow)) setBox(null);
    if (desktop && view === 'map' && follow && lastBounds.current) setBox(lastBounds.current);
  }, [desktop, view, follow]);

  const distances = useMemo(() => {
    if (!you) return null;
    return new Map(jobs.filter(isMappable).map((j) => [j.id, metresBetween(you, [j.longitude, j.latitude])]));
  }, [you, jobs]);
  const inArea = box ? jobs.filter((j) => isMappable(j) && inBounds(j, box)) : jobs;
  const elsewhere = box ? jobs.filter((j) => !isMappable(j)) : [];
  // Sorted by distance on the page: real listings still come first.
  const listed = byDistance && distances
    ? realFirst([...inArea].sort((a, b) => (distances.has(a.id) ? distances.get(a.id) : Infinity) - (distances.has(b.id) ? distances.get(b.id) : Infinity)))
    : inArea;
  const outside = you && !inLimits(you);

  return (
    <>
      <h1 className="page-title">Jobs in Milan</h1>
      <p className="muted jobs-lead">Part-time work, gigs and internships for students, in English.</p>

      <form
        className={'job-filters' + (filtersOpen ? ' is-open' : '')}
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
            placeholder="e.g. barista, tutor"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            enterKeyHint="search"
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary job-filters-toggle"
          aria-expanded={filtersOpen}
          aria-controls="job-filters-more"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters
          {folded > 0 && (
            <>
              <span className="filter-count" aria-hidden="true">{folded}</span>
              <span className="sr-only">, {folded} active</span>
            </>
          )}
        </button>
        <div className="job-filters-more" id="job-filters-more">
        <label className="field">
          Area
          <select className="select" name="area" value={filters.area} onChange={(e) => setFilter('area', e.target.value)}>
            <option value="">All areas</option>
            {areas.map((a) => (
              <option key={a.id} value={String(a.id)}>{a.name}</option>
            ))}
            {filters.area && !areas.some((a) => String(a.id) === filters.area) && (
              <option value={filters.area}>Chosen area</option>
            )}
          </select>
        </label>
        <label className="field">
          Category
          <select className="select" name="category" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
            <option value="">Any</option>
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Type of job
          <select className="select" name="type" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
            <option value="">Any type</option>
            {JOB_TYPES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Italian
          <select className="select" name="italian" value={filters.italian} onChange={(e) => setFilter('italian', e.target.value)}>
            <option value="">Any level</option>
            <option value="none">No Italian needed</option>
            <option value="basic">Basic Italian at most</option>
          </select>
        </label>
        <label className="field">
          Remote
          <select className="select" name="remote" value={filters.remote} onChange={(e) => setFilter('remote', e.target.value)}>
            <option value="">Any</option>
            <option value="yes">Remote</option>
            <option value="no">On site</option>
          </select>
        </label>
        <label className="field">
          Hours per week
          <select className="select" name="hours" value={filters.hours} onChange={(e) => setFilter('hours', e.target.value)}>
            <option value="">Any hours</option>
            {MAX_HOURS_OPTIONS.map((h) => (
              <option key={h} value={String(h)}>Up to {h} hours</option>
            ))}
          </select>
        </label>
        <MinPay value={filters.minpay} onChange={(v) => setFilter('minpay', v)} />
        <fieldset className="chip-filter">
          <legend>When <span className="chip-filter-note">flexible jobs always match</span></legend>
          <div className="chips">
            {SCHEDULES.filter(([v]) => v !== 'flexible').map(([value, label]) => (
              <button key={value} type="button" className="chip" aria-pressed={filters.when.includes(value)} onClick={() => toggleIn('when', value)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="chip-filter">
          <legend>Languages at work</legend>
          <div className="chips">
            {LANGUAGES.map(([value, label]) => (
              <button key={value} type="button" className="chip" aria-pressed={filters.lang.includes(value)} onClick={() => toggleIn('lang', value)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        </div>
      </form>

      <div className="jobs-status">
        <span className="muted tnum" aria-live="polite">
          {status === 'ready'
            ? box
              ? `${inArea.length} ${inArea.length === 1 ? 'job' : 'jobs'} in this map area` +
                (elsewhere.length ? ` · ${elsewhere.length} remote or without a location` : '')
              : `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}`
            : status === 'loading' ? 'Loading jobs…' : ''}
        </span>
        {box && !desktop && (
          <button type="button" className="btn-link" onClick={() => setBox(null)}>Show all jobs</button>
        )}
        {filtered && (
          <button type="button" className="btn-link tap-44" onClick={clearFilters}>Clear filters</button>
        )}
        <label className="sort-select">
          <span className="muted sort-word">Sort</span>
          <select className="select" name="sort" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
            <option value="">Newest</option>
            <option value="pay">Highest pay</option>
          </select>
        </label>
        <div className="view-toggle" role="group" aria-label="Show jobs as">
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
          <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</button>
        </div>
      </div>

      {filters.minpay && !filters.nohourly && hidden && hidden.total > 0 && (
        <p className="pay-note-hidden" role="status">
          {hidden.total} {hidden.total === 1 ? 'job' : 'jobs'} hidden: {hiddenKinds(hidden)}.{' '}
          <button type="button" className="btn-link" onClick={() => setFilter('nohourly', 'yes')}>
            {hidden.total === 1 ? 'Show it' : 'Show them'}
          </button>
        </p>
      )}
      {filters.minpay && filters.nohourly && (
        <p className="pay-note-hidden">
          Also showing jobs paid per project, unpaid or with pay not specified.{' '}
          <button type="button" className="btn-link" onClick={() => setFilter('nohourly', '')}>Hide them</button>
        </p>
      )}

      {canSave && filtered && <SaveSearch key={searchParamsText(filters)} filters={filters} areas={areas} />}

      {(view === 'map' || you) && (
        <div className="locate-row">
          {loc !== 'on' ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={locate} disabled={loc === 'asking'}>
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" /></svg>
              {loc === 'asking' ? 'Finding you…' : 'Use my location'}
            </button>
          ) : (
            <>
              <label className="check locate-sort">
                <input type="checkbox" checked={byDistance} onChange={(e) => setByDistance(e.target.checked)} /> Sort by distance
              </label>
              <button type="button" className="btn-link" onClick={forgetLocation}>Stop using my location</button>
            </>
          )}
          <span className="locate-note muted">Stays on your device: never sent to GigoMe or saved.</span>
          {loc === 'denied' && <span className="err locate-msg" role="alert">Location is turned off for this site in your browser. You can still move the map.</span>}
          {loc === 'error' && <span className="err locate-msg" role="alert">We couldn't find your location. Try again, or move the map.</span>}
          {loc === 'unavailable' && <span className="err locate-msg" role="alert">This browser can't share a location.</span>}
          {outside && <span className="muted locate-msg">You seem to be outside Milan, so the map stays on Milan.</span>}
        </div>
      )}

      <div className={'jobs-results' + (view === 'map' ? ' with-map' : '')}>
      <div className="jobs-list-col">

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

      {status === 'ready' && jobs.length === 0 && filtered && <NoMatch filters={filters} onClear={clearFilters} />}

      {box && status === 'ready' && jobs.length > 0 && inArea.length === 0 && (
        <div className="empty-state">
          <p><strong>No jobs in this part of the map.</strong></p>
          <p className="muted">Zoom out or move the map{elsewhere.length ? ', or see the remote jobs below' : ''}.</p>
        </div>
      )}

      {listed.length > 0 && status !== 'error' && (
        <ul className={'role-list job-list' + (status === 'loading' ? ' is-loading' : '')}>
          {listed.map((job) => (
            <JobCard key={job.id} job={job} distance={distances && distances.has(job.id) ? distanceLabel(distances.get(job.id)) : null} />
          ))}
        </ul>
      )}

      {elsewhere.length > 0 && status !== 'error' && (
        <section className="jobs-elsewhere" aria-labelledby="elsewhere-title">
          <h2 id="elsewhere-title" className="jobs-elsewhere-title">Remote / no location</h2>
          <p className="muted jobs-elsewhere-note">Not on the map, so not limited to the map area.</p>
          <ul className="role-list job-list">
            {elsewhere.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </ul>
        </section>
      )}
      </div>
      {view === 'map' && status !== 'error' && (
        <div className="jobs-map-col">
          <Suspense fallback={<div className="jobs-map jobs-map-loading" role="status">Loading the map…</div>}>
            <JobsMap jobs={jobs} onOpenJob={(id) => navigate(`/jobs/${id}`)} view={startView} autoFit={!kept} onViewChange={onViewChange} you={inLimits(you || [0, 0]) ? you : null}>
              {desktop ? (
                <label className="map-follow">
                  <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Search as I move the map
                </label>
              ) : (
                movedSinceSearch && (
                  <button type="button" className="map-search-area" onClick={searchThisArea}>Search this area</button>
                )
              )}
            </JobsMap>
          </Suspense>
          {status === 'ready' && jobs.length > 0 && jobs.some((j) => !isMappable(j)) && (
            <p className="jobs-map-aside muted">
              {jobs.filter((j) => !isMappable(j)).length} of these jobs {jobs.filter((j) => !isMappable(j)).length === 1 ? 'is' : 'are'} remote or
              without a place on the map; {jobs.filter((j) => !isMappable(j)).length === 1 ? 'it is' : 'they are'} in the list.
            </p>
          )}
        </div>
      )}
      </div>
    </>
  );
}

// The filters other than the keyword, as named in the advice below.
const FILTER_WORDS = {
  area: 'area', category: 'category', type: 'type of job', italian: 'Italian', remote: 'remote',
  hours: 'hours per week', when: 'days and times', lang: 'languages', minpay: 'minimum pay'
};
const orList = (words) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}` : words[0]);

// No job matches: advice for what is actually set (the keyword, other
// filters, or both).
function NoMatch({ filters, onClear }) {
  const set = FOLDED_FILTERS.filter((name) => (Array.isArray(filters[name]) ? filters[name].length : filters[name])).map((name) => FILTER_WORDS[name]);
  const q = filters.q;
  let title, advice;
  if (q && !set.length) {
    title = `No jobs match “${q}”.`;
    advice = 'Check the spelling, or try a shorter or more general word, like “barista” or “tutor”.';
  } else if (q) {
    title = `No jobs match “${q}” with these filters.`;
    advice = `Try another keyword, or remove a filter: ${orList(set)}.`;
  } else {
    title = 'No jobs match these filters.';
    advice = set.length > 1 ? `Try removing one: ${orList(set)}.` : `Try removing the ${set[0]} filter.`;
  }
  return (
    <div className="empty-state">
      <p><strong>{title}</strong></p>
      <p className="muted">{advice}</p>
      <button type="button" className="btn btn-secondary btn-sm tap-44" onClick={onClear}>
        {q && !set.length ? 'Clear the keyword' : 'Clear filters'}
      </button>
    </div>
  );
}

// "Save this search": students keep the current filters under a name, on
// /saved. Only they can see it; nothing is emailed.
function SaveSearch({ filters, areas }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [state, setState] = useState({ busy: false, error: '', done: false });
  if (state.done) {
    return (
      <p className="save-search-done" role="status">
        Search saved. Find it on <Link to="/saved#saved-searches">Saved jobs</Link>.
      </p>
    );
  }
  if (!open) {
    return (
      <p className="save-search-open">
        <button type="button" className="btn-link" onClick={() => { setName(searchSummary(filters, areas).slice(0, 60)); setOpen(true); }}>
          Save this search
        </button>
      </p>
    );
  }
  return (
    <form className="save-search" onSubmit={async (e) => {
      e.preventDefault();
      if (!name.trim()) {
        setState({ busy: false, error: 'Give the search a name.', done: false });
        return;
      }
      setState({ busy: true, error: '', done: false });
      try {
        await saveSearch(name, filters);
        setState({ busy: false, error: '', done: true });
      } catch (err) {
        setState({ busy: false, error: err.message, done: false });
      }
    }}>
      <label className="field save-search-name">
        Name this search
        <input className="input" name="search_name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="save-search-buttons">
        <button type="submit" className="btn btn-primary btn-sm" disabled={state.busy}>{state.busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn btn-tertiary btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <p className="field-hint save-search-hint">Shown only to you, on Saved jobs, with how many jobs are new since you last opened it. No emails.</p>
      {state.error && <p className="err" role="alert">{state.error}</p>}
    </form>
  );
}

// "Minimum pay": a slider in € an hour (by the hourly equivalent, which
// hourly and monthly pay have). The list follows once the slider rests.
function MinPay({ value, onChange }) {
  const [v, setV] = useState(Number(value) || 0);
  useEffect(() => setV(Number(value) || 0), [value]);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  function move(next) {
    setV(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next > 0 ? String(next) : ''), 350);
  }
  return (
    <label className="field min-pay">
      <span className="min-pay-label">
        Minimum pay <output className="min-pay-value tnum" htmlFor="min-pay">{v > 0 ? `€${v}/h` : 'Any'}</output>
      </span>
      <input id="min-pay" className="min-pay-range" type="range" name="minpay" min={0} max={MAX_MIN_PAY} step={1} value={v}
        onChange={(e) => move(Number(e.target.value))} aria-valuetext={v > 0 ? `${v} euros an hour or more` : 'Any pay'} />
      <span className="field-hint min-pay-hint">Monthly pay counts by its hourly equivalent.</span>
    </label>
  );
}
