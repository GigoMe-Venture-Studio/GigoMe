import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import AuthShell from '../components/AuthShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import { DEGREE_LEVELS, fetchProfile, logOut, saveProfile } from '../lib/auth.js';

export default function Welcome() {
  return <AuthShell>{supabase ? <WelcomeGate /> : <ConfigError />}</AuthShell>;
}

function WelcomeGate() {
  const { session, loading } = useSession();
  if (loading) return <p className="auth-card muted">Loading…</p>;
  if (!session) return <Navigate to="/login" replace />;
  return <WelcomeForm user={session.user} />;
}

// Graduation years on offer: last year to eight years from now (the database
// accepts 1990 to 2100; a saved value outside this range is still shown).
function yearOptions(saved) {
  const now = new Date().getFullYear();
  const years = [];
  for (let y = now - 1; y <= now + 8; y++) years.push(y);
  if (saved && !years.includes(saved)) years.unshift(saved);
  return years;
}

function WelcomeForm({ user }) {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [fullName, setFullName] = useState('');
  const [degree, setDegree] = useState('');
  const [year, setYear] = useState('');
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchProfile(user.id)
      .then((p) => {
        if (!active) return;
        if (p) {
          setFullName(p.full_name || '');
          setDegree(p.degree_level || '');
          setYear(p.graduation_year ? String(p.graduation_year) : '');
        }
        setLoaded(true);
      })
      .catch(() => active && setLoadError("We couldn't load your profile. Check your connection and reload the page."));
    return () => {
      active = false;
    };
  }, [user.id]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaveError('');
    const name = fullName.trim().replace(/\s+/g, ' ');
    const next = {};
    if (!name) next.fullName = 'Add your full name.';
    else if (name.length > 120) next.fullName = 'Keep your name under 120 characters.';
    if (!degree) next.degree = 'Choose what you are studying.';
    if (!year) next.year = 'Choose the year you expect to graduate.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await saveProfile(user.id, { full_name: name, degree_level: degree, graduation_year: Number(year) });
      navigate('/', { replace: true });
    } catch {
      setSaveError("We couldn't save your details. Check your connection and try again.");
      setBusy(false);
    }
  }

  if (loadError) return <p className="auth-card err" role="alert">{loadError}</p>;
  if (!loaded) return <p className="auth-card muted">Loading…</p>;

  return (
    <div className="auth-card">
      <p className="auth-small">
        Logged in as <strong className="auth-email">{user.email}</strong> ·{' '}
        <button type="button" className="btn-link" onClick={async () => setSaveError((await logOut()) || '')}>
          Log out
        </button>
      </p>
      <h1 className="auth-title-gap">Welcome to GigoMe</h1>
      <p className="lead">Tell us a little about yourself. You can change this later.</p>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label className="field">
          Full name
          <input
            className="input"
            type="text"
            name="full_name"
            autoComplete="name"
            maxLength={120}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-invalid={Boolean(errors.fullName)}
            required
          />
          {errors.fullName && <span className="err">{errors.fullName}</span>}
        </label>
        <label className="field">
          What are you studying?
          <select
            className="select"
            name="degree_level"
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            aria-invalid={Boolean(errors.degree)}
            required
          >
            <option value="">Choose…</option>
            {DEGREE_LEVELS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {errors.degree && <span className="err">{errors.degree}</span>}
        </label>
        <label className="field">
          Expected graduation year
          <select
            className="select"
            name="graduation_year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            aria-invalid={Boolean(errors.year)}
            required
          >
            <option value="">Choose…</option>
            {yearOptions(Number(year) || null).map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          {errors.year && <span className="err">{errors.year}</span>}
        </label>
        {saveError && <p className="err" role="alert">{saveError}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </div>
  );
}
