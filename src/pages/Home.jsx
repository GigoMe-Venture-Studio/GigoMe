import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import JobCard from '../components/JobCard.jsx';
import { supabase } from '../lib/supabase.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { cleanKeyword, fetchJobs, filtersToParams } from '../lib/jobs.js';
import { fetchAreas } from '../lib/areas.js';

export default function Home() {
  return (
    <main>
      <DeletedNotice />
      <section className="wrap hero" aria-labelledby="home-title">
        <h1 id="home-title">Part-time work and internships in Milan, in English.</h1>
        <p className="hero-lead">For international students who don't speak fluent Italian. Free for students, always.</p>
        <HeroSearch />
      </section>

      <section className="wrap home-newest" aria-labelledby="newest-title">
        <div className="newest-head">
          <h2 className="section-title" id="newest-title">Newest jobs</h2>
        </div>
        <NewestJobs />
      </section>

      <section className="wrap how" aria-labelledby="how-title">
        <h2 className="section-title how-head" id="how-title">How it works</h2>
        <div>
          <h3>For students</h3>
          <ol>
            <li><Link to="/jobs">Browse jobs</Link>: part-time work, gigs and internships you can do in English.</li>
            <li>Log in with your university email. We send you a 6-digit code, no password needed.</li>
            <li>Apply directly with the employer, on their website or by email.</li>
          </ol>
        </div>
        <div>
          <h3>For employers</h3>
          <p>
            Want to list a job? Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
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
            <option value="">Anywhere in Milan</option>
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

function NewestJobs() {
  const [state, setState] = useState({ status: supabase ? 'loading' : 'unavailable', jobs: [] });

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
          <JobCard key={job.id} job={job} />
        ))}
      </ul>
      <Link className="see-all" to="/jobs">See all jobs</Link>
    </>
  );
}
