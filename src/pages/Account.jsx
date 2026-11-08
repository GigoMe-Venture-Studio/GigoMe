import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import ProfileFields from '../components/ProfileFields.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import { saveProfile } from '../lib/auth.js';
import { announceProfileChange, checkProfile } from '../lib/profile.js';
import { deleteMyAccount, endDeletedSession, fetchAccount } from '../lib/account.js';

export default function Account() {
  return <PageShell>{supabase ? <AccountGate /> : <ConfigError />}</PageShell>;
}

function AccountGate() {
  const { session, loading } = useSession();
  const [leaving, setLeaving] = useState(false);
  if (loading) return <p className="auth-card muted">Loading…</p>;
  // While the account is being deleted the session ends; don't bounce to /login.
  if (!session && !leaving) return <Navigate to={'/login?next=' + encodeURIComponent('/account')} replace />;
  if (!session) return <p className="auth-card muted">Deleting your account…</p>;
  return <AccountPage user={session.user} onLeaving={() => setLeaving(true)} />;
}

function AccountPage({ user, onLeaving }) {
  const [state, setState] = useState({ status: 'loading', account: null });

  useEffect(() => {
    let active = true;
    fetchAccount(user.id)
      .then((account) => active && setState({ status: 'ready', account }))
      .catch(() => active && setState({ status: 'error', account: null }));
    return () => {
      active = false;
    };
  }, [user.id]);

  if (state.status === 'loading') return <p className="auth-card muted">Loading…</p>;
  if (state.status === 'error') {
    return <p className="auth-card err" role="alert">We couldn't load your account. Check your connection and reload the page.</p>;
  }

  const account = state.account || {};
  const isCompany = account.account_type === 'company';
  const university = account.universities ? account.universities.name : null;

  return (
    <div className="auth-card account">
      <h1>Your account</h1>
      <dl className="account-facts">
        <div>
          <dt>Email</dt>
          <dd className="auth-email">{user.email}</dd>
        </div>
        <div>
          <dt>University</dt>
          <dd>{university || (isCompany ? 'None (company account)' : 'None')}</dd>
        </div>
      </dl>
      <p className="auth-small">Your email and university come from the address you log in with and can't be changed here.</p>

      <ProfileForm userId={user.id} account={account} student={!isCompany} />

      <DeleteAccount isCompany={isCompany} onLeaving={onLeaving} />
    </div>
  );
}

function ProfileForm({ userId, account, student }) {
  const [values, setValues] = useState({
    fullName: account.full_name || '',
    degree: account.degree_level || '',
    year: account.graduation_year ? String(account.graduation_year) : ''
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ kind: 'idle', message: '' });

  function onChange(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
    if (status.kind === 'saved') setStatus({ kind: 'idle', message: '' });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const { errors: found, fields } = checkProfile(values, { student });
    setErrors(found);
    if (!fields) return;
    setStatus({ kind: 'busy', message: '' });
    try {
      await saveProfile(userId, fields);
      setValues((v) => ({ ...v, fullName: fields.full_name }));
      announceProfileChange();
      setStatus({ kind: 'saved', message: 'Your changes are saved.' });
    } catch {
      setStatus({ kind: 'error', message: "We couldn't save your changes. Check your connection and try again." });
    }
  }

  return (
    <section className="account-section" aria-labelledby="profile-title">
      <h2 id="profile-title">Your details</h2>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <ProfileFields values={values} onChange={onChange} errors={errors} student={student} />
        {status.kind === 'error' && <p className="err" role="alert">{status.message}</p>}
        <p className="account-saved" role="status">{status.kind === 'saved' ? status.message : ''}</p>
        <button type="submit" className="btn btn-primary" disabled={status.kind === 'busy'}>
          {status.kind === 'busy' ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </section>
  );
}

const CONFIRM_WORD = 'DELETE';

// Two steps: first a reminder with "Keep my account" and "Delete my account"
// side by side, then the explanation and the typed DELETE confirmation.
function DeleteAccount({ isCompany, onLeaving }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('ask');
  const [kept, setKept] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirmed = typed.trim() === CONFIRM_WORD;

  async function onSubmit(e) {
    e.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    setError('');
    onLeaving();
    const failed = await deleteMyAccount();
    if (failed) {
      setError(failed);
      setBusy(false);
      return;
    }
    navigate('/', { replace: true, state: { accountDeleted: true } });
    endDeletedSession();
  }

  function keep() {
    setStep('ask');
    setTyped('');
    setError('');
    setKept(true);
  }

  if (step === 'ask') {
    return (
      <section className="account-section account-danger" aria-labelledby="delete-title">
        <h2 id="delete-title">Delete my account</h2>
        <p className="account-danger-text">
          Before you go, remember that new opportunities are added regularly. You can keep your profile ready for the
          next role whenever the time is right. Still want to leave? You can delete your account below.
        </p>
        {kept && <p className="account-kept" role="status">Good, your account stays as it is.</p>}
        <div className="account-choice">
          <button type="button" className="btn btn-secondary" onClick={keep}>Keep my account</button>
          <button type="button" className="btn btn-secondary" onClick={() => { setKept(false); setStep('confirm'); }}>
            Delete my account
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="account-section account-danger" aria-labelledby="delete-title">
      <h2 id="delete-title">Delete my account</h2>
      <div className="account-danger-text">
        <p>
          This deletes your account, your profile and any feedback you sent.{' '}
          {isCompany ? 'Your company, its jobs and how to apply for them are deleted too. ' : ''}
          <strong>It can't be undone.</strong>
        </p>
        <p className="muted">
          GigoMe counts apply clicks on each job (how often students pressed "Apply"). Yours stay in those counts, but
          are no longer linked to you.
        </p>
      </div>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label className="field">
          Type {CONFIRM_WORD} to confirm
          <input
            className="input"
            type="text"
            name="confirm"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
          />
        </label>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="account-choice">
          <button type="button" className="btn btn-secondary" onClick={keep} disabled={busy}>Keep my account</button>
          <button type="submit" className="btn btn-secondary account-delete-btn" disabled={!confirmed || busy}>
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </form>
    </section>
  );
}
