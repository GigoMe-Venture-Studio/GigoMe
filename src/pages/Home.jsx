import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import JobCard from '../components/JobCard.jsx';
import { SectionErrorBoundary } from '../components/ErrorBoundary.jsx';
import { supabase } from '../lib/supabase.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { cleanKeyword, fetchJobs, fetchMapJobs, filtersToParams } from '../lib/jobs.js';
import { fetchAreas } from '../lib/areas.js';
import { useT } from '../lib/useLang.js';

// The map code (MapLibre) is only downloaded once the map is about to scroll
// into view: see HomeMap.
const JobsMap = lazy(() => import('../components/JobsMap.jsx'));

export default function Home() {
  // The map waits until the newest jobs are on the page: before that it would
  // sit right under the hero, near enough to start loading on its own.
  const [newestShown, setNewestShown] = useState(false);
  const t = useT();
  const email = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <main>
      <DeletedNotice />
      <section className="wrap hero" aria-labelledby="home-title">
        <h1 id="home-title">{t('home.title')}</h1>
        <p className="hero-lead">{t('home.lead')}</p>
        <HeroSearch />
      </section>

      <section className="wrap home-newest" aria-labelledby="newest-title">
        <div className="newest-head">
          <h2 className="section-title" id="newest-title">{t('home.newestTitle')}</h2>
        </div>
        <NewestJobs onShown={setNewestShown} />
      </section>

      {newestShown && <HomeMap />}

      <section className="wrap how" aria-labelledby="how-title">
        <h2 className="section-title how-head" id="how-title">{t('home.howTitle')}</h2>
        <div>
          <h3>{t('home.forStudents')}</h3>
          <ol>
            <li>{t('home.step1', { link: (s) => <Link to="/jobs">{s}</Link> })}</li>
            <li>{t('home.step2')}</li>
            <li>{t('home.step3')}</li>
          </ol>
        </div>
        <div>
          <h3>{t('home.forEmployers')}</h3>
          <p>{t('home.employers', { link: (s) => <Link to="/employers">{s}</Link> })}</p>
          <p className="how-questions">{t('home.questions', { email })}</p>
          <p className="how-more">
            <Link to="/how-it-works">{t('home.moreHow')}</Link> · <Link to="/safety">{t('home.safety')}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

// "Your account has been deleted", once, after /account deleted it. The flag
// comes in the navigation state and is cleared right away, so a reload
// doesn't show it again.
function DeletedNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const [show] = useState(() => Boolean(location.state && location.state.accountDeleted));
  const t = useT();

  useEffect(() => {
    if (location.state && location.state.accountDeleted) navigate('/', { replace: true, state: null });
  }, [location.state, navigate]);

  if (!show) return null;
  return (
    <div className="wrap">
      <p className="home-notice" role="status">{t('home.deleted')}</p>
    </div>
  );
}

// Opens /jobs with the keyword, area and "No Italian needed" applied.
function HeroSearch() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [noItalian, setNoItalian] = useState(true);
  const [area, setArea] = useState('');
  const [areas, setAreas] = useState([]);
  const t = useT();
  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => setAreas([]));
  }, []);

  function onSubmit(e) {
    e.preventDefault();
    const params = new URLSearchParams(
      filtersToParams({ q: cleanKeyword(keyword), area, italian: noItalian ? 'none' : '' })
    ).toString();
    navigate('/jobs' + (params ? '?' + params : ''));
  }

  return (
    <form className="hero-search" role="search" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="home-q">{t('home.keywordLabel')}</label>
      <input
        className="input q"
        id="home-q"
        type="search"
        placeholder={t('home.keywordPlaceholder')}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        enterKeyHint="search"
      />
      {areas.length > 0 && (
        <>
          <label className="sr-only" htmlFor="home-area">{t('home.areaLabel')}</label>
          <select className="select area" id="home-area" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">{t('home.allAreas')}</option>
            {areas.map((a) => (
              <option key={a.id} value={String(a.id)}>{a.name}</option>
            ))}
          </select>
        </>
      )}
      <label className="check">
        <input type="checkbox" checked={noItalian} onChange={(e) => setNoItalian(e.target.checked)} /> {t('italian.none')}
      </label>
      <button type="submit" className="btn btn-primary btn-lg">{t('home.search')}</button>
    </form>
  );
}

// onShown: called once there are jobs on the page (not when there are none
// or they can't be loaded: then there is nothing to show on a map either).
function NewestJobs({ onShown }) {
  const [state, setState] = useState({ status: supabase ? 'loading' : 'unavailable', jobs: [] });
  const shown = state.status === 'ready' && state.jobs.length > 0;
  const t = useT();
  useEffect(() => {
    if (shown) onShown(true);
  }, [shown, onShown]);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    fetchJobs({}, { limit: 5 })
      .then((jobs) => active && setState({ status: 'ready', jobs }))
      .catch(() => active && setState({ status: 'error', jobs: [] }));
    return () => {
      active = false;
    };
  }, []);

  const { status, jobs } = state;
  if (status === 'loading') return <p className="muted home-jobs-note">{t('home.loadingJobs')}</p>;
  if (status === 'unavailable' || status === 'error') {
    return (
      <div className="empty-state">
        <p><strong>{t('home.loadErrorTitle')}</strong></p>
        <p className="muted">{t('home.loadErrorText', { link: (s) => <Link to="/jobs">{s}</Link> })}</p>
      </div>
    );
  }
  if (!jobs.length) {
    return (
      <div className="empty-state">
        <p><strong>{t('home.emptyTitle')}</strong></p>
        <p className="muted">
          {t('home.emptyText', { email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> })}
        </p>
      </div>
    );
  }
  return (
    <>
      <ul className="role-list job-list">
        {jobs.map((job) => (
          // No Save buttons here, for anyone: one would sit under the
          // Feedback button at first load, which then steps aside, and the
          // button must be fully visible on the home page. Students save from
          // /jobs and job pages.
          <JobCard key={job.id} job={job} save={false} />
        ))}
      </ul>
      <Link className="see-all" to="/jobs">{t('home.seeAll')}</Link>
    </>
  );
}

// "Map of current jobs", under "Newest jobs". Nothing for it (the jobs it shows,
// the map code, tiles, the metro file) is downloaded until it is within 300px
// of the screen, as on job pages, so a visitor who never scrolls down gets
// nothing extra. One finger scrolls the page over it; two fingers move it.
// Only jobs with an exact location get a pin: an area-only job's point is
// just its area's centre. If the map can't load, the rest of the page works
// as before.
// Room around the pins when the map fits them: the zoom and "Metro" buttons
// are on the right, the credits at the bottom.
const HOME_MAP_PADDING = { top: 40, right: 96, bottom: 72, left: 40 };

function HomeMap() {
  const navigate = useNavigate();
  const spot = useRef(null);
  const [near, setNear] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [state, setState] = useState({ status: 'waiting', jobs: [] });
  const t = useT();

  // Until the visitor scrolls, the map loads only if it is already on the
  // screen (a tall desktop screen); after any scroll, from 300px away, like
  // the job pages' map.
  useEffect(() => {
    if (scrolled || near) return undefined;
    const on = () => setScrolled(true);
    window.addEventListener('scroll', on, { passive: true, once: true });
    return () => window.removeEventListener('scroll', on);
  }, [scrolled, near]);

  useEffect(() => {
    if (near || !spot.current) return undefined;
    if (!('IntersectionObserver' in window)) {
      setNear(true);
      return undefined;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
      rootMargin: scrolled ? '300px' : '0px'
    });
    io.observe(spot.current);
    return () => io.disconnect();
  }, [near, scrolled]);

  useEffect(() => {
    if (!near) return undefined;
    let active = true;
    fetchMapJobs()
      .then((jobs) => active && setState({ status: 'ready', jobs }))
      .catch(() => active && setState({ status: 'error', jobs: [] }));
    return () => {
      active = false;
    };
  }, [near]);

  const { status, jobs } = state;
  let body;
  const failed = (
    <p className="home-map-note" role="alert">
      {t('home.mapFailed', { link: (s) => <Link to="/jobs">{s}</Link> })}
    </p>
  );
  if (status === 'error') {
    body = failed;
  } else if (status === 'ready' && !jobs.length) {
    body = (
      <p className="home-map-note">{t('home.mapNone', { link: (s) => <Link to="/jobs">{s}</Link> })}</p>
    );
  } else if (status === 'ready') {
    body = (
      <SectionErrorBoundary fallback={failed}>
        <Suspense fallback={<div className="jobs-map jobs-map-loading" role="status">{t('home.mapLoading')}</div>}>
          <JobsMap
            jobs={jobs}
            cooperative
            fitPadding={HOME_MAP_PADDING}
            label={t('home.mapTitle')}
            errorNote={t('home.mapErrorNote')}
            onOpenJob={(id) => navigate(`/jobs/${id}`)}
          />
        </Suspense>
      </SectionErrorBoundary>
    );
  } else {
    body = <div className="jobs-map jobs-map-loading" aria-hidden="true" />;
  }

  return (
    <section className="wrap home-map" aria-labelledby="map-title">
      <h2 className="section-title" id="map-title">{t('home.mapTitle')}</h2>
      <p className="muted home-map-lead">
        {t('home.mapLead', { link: (s) => <Link to="/jobs">{s}</Link> })}
      </p>
      <div ref={spot} className="home-map-box">{body}</div>
    </section>
  );
}
