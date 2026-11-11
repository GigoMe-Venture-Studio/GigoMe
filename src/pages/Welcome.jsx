import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import ProfileFields from '../components/ProfileFields.jsx';
import TermsCheckbox from '../components/TermsCheckbox.jsx';
import { fetchProfile, logOut, safeNext, saveProfile } from '../lib/auth.js';
import { announceProfileChange, checkProfile } from '../lib/profile.js';
import { TERMS_REQUIRED, acceptTerms, hasAcceptedTerms } from '../lib/terms.js';

// /welcome: a new student's name, degree and graduation year, and for every
// account (students and companies) the Terms ("I'm 18 or older and I accept
// the Terms") until the current version is accepted. TermsGate sends
// accounts here, with ?next= the page they asked for.
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
  // termsOnly: the account only needs to accept the Terms (a company account,
  // or a student who already gave their details).
  const [needs, setNeeds] = useState({ terms: true, termsOnly: false });
  const [termsTicked, setTermsTicked] = useState(false);
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
        const terms = !hasAcceptedTerms(p);
        setNeeds({ terms, termsOnly: terms && Boolean(p) && (p.account_type !== 'student' || Boolean(p.full_name)) });
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
    let fields = null;
    let found = {};
    if (!needs.termsOnly) ({ errors: found, fields } = checkProfile({ fullName, degree, year }));
    if (needs.terms && !termsTicked) found = { ...found, terms: TERMS_REQUIRED };
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      if (fields) await saveProfile(user.id, fields);
      if (needs.terms) await acceptTerms(user.id);
      announceProfileChange();
      navigate(next || '/', { replace: true });
    } catch {
      setSaveError(needs.termsOnly
        ? "We couldn't save that. Check your connection and try again."
        : "We couldn't save your details. Check your connection and try again.");
      setBusy(false);
    }
  }

  if (loadError) return <p className="auth-card err" role="alert">{loadError}</p>;
  if (!loaded) return <p className="auth-card muted">Loading…</p>;

  const terms = needs.terms && (
    <TermsCheckbox checked={termsTicked} onChange={setTermsTicked} error={errors.terms} />
  );

  return (
    <div className="auth-card">
      <p className="auth-small">
        Logged in as <strong className="auth-email">{user.email}</strong> ·{' '}
        <button type="button" className="btn-link" onClick={async () => setSaveError((await logOut()) || '')}>
          Log out
        </button>
      </p>
      {needs.termsOnly ? (
        <>
          <h1 className="auth-title-gap">Before you continue</h1>
          <p className="lead">To use GigoMe, please confirm the following. We only ask once.</p>
        </>
      ) : (
        <>
          <h1 className="auth-title-gap">Welcome to GigoMe</h1>
          <p className="lead">Tell us a little about yourself. You can change this later.</p>
        </>
      )}
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {!needs.termsOnly && (
          <ProfileFields
            values={{ fullName, degree, year }}
            onChange={(key, value) => ({ fullName: setFullName, degree: setDegree, year: setYear })[key](value)}
            errors={errors}
          />
        )}
        {terms}
        {saveError && <p className="err" role="alert">{saveError}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : needs.termsOnly ? 'Continue' : 'Save and continue'}
        </button>
      </form>
    </div>
  );
}
