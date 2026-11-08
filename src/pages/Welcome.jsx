import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import ProfileFields from '../components/ProfileFields.jsx';
import { fetchProfile, logOut, safeNext, saveProfile } from '../lib/auth.js';
import { announceProfileChange, checkProfile } from '../lib/profile.js';

export default function Welcome() {
  return <PageShell>{supabase ? <WelcomeGate /> : <ConfigError />}</PageShell>;
}

function WelcomeGate() {
  const { session, loading } = useSession();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  if (loading) return <p className="auth-card muted">Loading…</p>;
  if (!session) return <Navigate to={'/login' + (next ? '?next=' + encodeURIComponent(next) : '')} replace />;
  return <WelcomeForm user={session.user} next={next} />;
}

function WelcomeForm({ user, next }) {
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
    const { errors: found, fields } = checkProfile({ fullName, degree, year });
    setErrors(found);
    if (!fields) return;
    setBusy(true);
    try {
      await saveProfile(user.id, fields);
      announceProfileChange();
      navigate(next || '/', { replace: true });
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
        <ProfileFields
          values={{ fullName, degree, year }}
          onChange={(key, value) => ({ fullName: setFullName, degree: setDegree, year: setYear })[key](value)}
          errors={errors}
        />
        {saveError && <p className="err" role="alert">{saveError}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </div>
  );
}
