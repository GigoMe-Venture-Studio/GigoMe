import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import JobCard from '../components/JobCard.jsx';
import { SectionErrorBoundary } from '../components/ErrorBoundary.jsx';
import { supabase } from '../lib/supabase.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { cleanKeyword, fetchJobs, fetchMapJobs, filtersToParams } from '../lib/jobs.js';
import { fetchAreas } from '../lib/areas.js';

// The map code (MapLibre) is only downloaded once the map is about to scroll
// into view: see HomeMap.
const JobsMap = lazy(() => import('../components/JobsMap.jsx'));

export default function Home() {
  // The map waits until the newest jobs are on the page: before that it would
  // sit right under the hero, near enough to start loading on its own.
  const [newestShown, setNewestShown] = useState(false);
  return (
    <main>
      <DeletedNotice />
      <section className="wrap hero" aria-labelledby="home-title">
        <h1 id="home-title">Part-time jobs and gigs in Milan, in English.</h1>
        <p className="hero-lead">For international students who don't speak fluent Italian. Free for students, always.</p>
        <HeroSearch />
      </section>

      <section className="wrap home-newest" aria-labelledby="newest-title">
        <div className="newest-head">
          <h2 className="section-title" id="newest-title">Newest jobs</h2>
        </div>
        <NewestJobs onShown={setNewestShown} />
      </section>

      {newestShown && <HomeMap />}

      <section className="wrap how" aria-labelledby="how-title">
        <h2 className="section-title how-head" id="how-title">How it works</h2>
        <div>
          <h3>For students</h3>
          <ol>
            <li><Link to="/jobs">Browse jobs</Link>: part-time jobs and gigs you can do in English.</li>
            <li>Log in with your university email. We send you a 6-digit code, no password needed.</li>
            <li>Apply directly with the employer, on their website or by email.</li>
          </ol>
        </div>
        <div>
          <h3>For employers</h3>
          <p>
            Want to list a job? It's free: <Link to="/employers">see how it works for employers</Link>.
          </p>
          <p className="how-questions">
            Questions? Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
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

  useEffect(() => {
    if (location.state && location.state.accountDeleted) navigate('/', { replace: true, state: null });
  }, [location.state, navigate]);

  if (!show) return null;
  return (
    <div className="wrap">
      <p className="home-notice" role="status">Your account has been deleted.</p>
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
      <label className="sr-only" htmlFor="home-q">Role or keyword</label>
      <input
        className="input q"
        id="home-q"
        type="search"
        placeholder="Role or keyword, e.g. tutor"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        enterKeyHint="search"
      />
      {areas.length > 0 && (
        <>
          <label className="sr-only" htmlFor="home-area">Area</label>
          <select className="select area" id="home-area" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All areas</option>
            {areas.map((a) => (
              <option key={a.id} value={String(a.id)}>{a.name}</option>
            ))}
          </select>
        </>
      )}
      <label className="check">
        <input type="checkbox" checked={noItalian} onChange={(e) => setNoItalian(e.target.checked)} /> No Italian needed
      </label>
      <button type="submit" className="btn btn-primary btn-lg">Search jobs</button>
    </form>
  );
}

// onShown: called once there are jobs on the page (not when there are none
// or they can't be loaded: then there is nothing to show on a map either).
function NewestJobs({ onShown }) {
  const [state, setState] = useState({ status: supabase ? 'loading' : 'unavailable', jobs: [] });
  const shown = state.status === 'ready' && state.jobs.length > 0;
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
  if (status === 'loading') return <p className="muted home-jobs-note">Loading jobs…</p>;
  if (status === 'unavailable' || status === 'error') {
    return (
      <div className="empty-state">
        <p><strong>Jobs can't be shown right now.</strong></p>
        <p className="muted">Please try again in a moment, or <Link to="/jobs">open the job list</Link>.</p>
      </div>
    );
  }
  if (!jobs.length) {
    return (
      <div className="empty-state">
        <p><strong>No jobs yet.</strong></p>
        <p className="muted">
          New jobs are added as employers join GigoMe, so check back soon. Know a business that's hiring? Tell us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
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
      <Link className="see-all" to="/jobs">See all jobs</Link>
    </>
  );
}

// "Jobs on the map", under "Newest jobs". Nothing for it (the jobs it shows,
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
      The map can't be shown right now. <Link to="/jobs">See all jobs in the list</Link>.
    </p>
  );
  if (status === 'error') {
    body = failed;
  } else if (status === 'ready' && !jobs.length) {
    body = <p className="home-map-note">No job has an exact address on the map right now. <Link to="/jobs">See all jobs</Link>.</p>;
  } else if (status === 'ready') {
    body = (
      <SectionErrorBoundary fallback={failed}>
        <Suspense fallback={<div className="jobs-map jobs-map-loading" role="status">Loading the map…</div>}>
          <JobsMap
            jobs={jobs}
            cooperative
            fitPadding={HOME_MAP_PADDING}
            label="Map of current jobs"
            errorNote="The map can't be shown right now. Every job is in the job list."
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
      <h2 className="section-title" id="map-title">Jobs on the map</h2>
      <p className="muted home-map-lead">
        Jobs with an exact address. Jobs that show only their area, and remote jobs, are in the <Link to="/jobs">job list</Link>.
      </p>
      <div ref={spot} className="home-map-box">{body}</div>
    </section>
  );
}
