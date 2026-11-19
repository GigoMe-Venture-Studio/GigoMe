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
import { collectMyData, downloadJson } from '../lib/myData.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { useT } from '../lib/useLang.js';

export default function Account() {
  return <PageShell>{supabase ? <AccountGate /> : <ConfigError />}</PageShell>;
}

function AccountGate() {
  const { session, loading } = useSession();
  const [leaving, setLeaving] = useState(false);
  const t = useT();
  if (loading) return <p className="auth-card muted">{t('common.loading')}</p>;
  // While the account is being deleted the session ends; don't bounce to /login.
  if (!session && !leaving) return <Navigate to={'/login?next=' + encodeURIComponent('/account')} replace />;
  if (!session) return <p className="auth-card muted">{t('account.deleting')}</p>;
  return <AccountPage user={session.user} onLeaving={() => setLeaving(true)} />;
}

function AccountPage({ user, onLeaving }) {
  const [state, setState] = useState({ status: 'loading', account: null });
  const t = useT();

  useEffect(() => {
    let active = true;
    fetchAccount(user.id)
      .then((account) => active && setState({ status: 'ready', account }))
      .catch(() => active && setState({ status: 'error', account: null }));
    return () => {
      active = false;
    };
  }, [user.id]);

  if (state.status === 'loading') return <p className="auth-card muted">{t('common.loading')}</p>;
  if (state.status === 'error') {
    return <p className="auth-card err" role="alert">{t('account.loadError')}</p>;
  }

  const account = state.account || {};
  const isCompany = account.account_type === 'company';
  const university = account.universities ? account.universities.name : account.other_university || null;
  const verified = account.student_verification === 'university_email';

  return (
    <div className="auth-card account">
      <h1>{t('account.title')}</h1>
      <dl className="account-facts">
        <div>
          <dt>{t('account.email')}</dt>
          <dd className="auth-email">{user.email}</dd>
        </div>
        <div>
          <dt>{t('account.university')}</dt>
          <dd>{university || (isCompany ? t('account.noneCompany') : t('account.none'))}</dd>
        </div>
        {!isCompany && (
          <div>
            <dt>{t('account.studentStatus')}</dt>
            <dd className="account-verification">
              {verified ? t('account.verified') : t('account.notVerified')}
            </dd>
          </div>
        )}
      </dl>
      <p className="auth-small">
        {isCompany || verified
          ? t('account.fixedNote')
          : t('account.fixedNoteDeclared', { email: CONTACT_EMAIL })}
      </p>

      <ProfileForm userId={user.id} account={account} student={!isCompany} />

      <DownloadData user={user} isCompany={isCompany} />

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
  const t = useT();

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
      setStatus({ kind: 'saved', message: 'account.saved' });
    } catch {
      setStatus({ kind: 'error', message: 'account.saveError' });
    }
  }

  return (
    <section className="account-section" aria-labelledby="profile-title">
      <h2 id="profile-title">{t('account.detailsTitle')}</h2>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <ProfileFields values={values} onChange={onChange} errors={errors} student={student} />
        {status.kind === 'error' && <p className="err" role="alert">{t(status.message)}</p>}
        <p className="account-saved" role="status">{status.kind === 'saved' ? t(status.message) : ''}</p>
        <button type="submit" className="btn btn-primary" disabled={status.kind === 'busy'}>
          {status.kind === 'busy' ? t('account.saving') : t('account.saveChanges')}
        </button>
      </form>
    </section>
  );
}

const CONFIRM_WORD = 'DELETE';

// Two steps: first a reminder with "Keep my account" and "Delete my account"
// side by side, then the explanation and the typed DELETE confirmation.
// "Download my data": a JSON file built in the browser from the user's own
// rows. Nothing is stored or sent anywhere.
function DownloadData({ user, isCompany }) {
  const [state, setState] = useState({ busy: false, message: '', error: false });
  const t = useT();
  async function onDownload() {
    setState({ busy: true, message: '', error: false });
    try {
      const data = await collectMyData(user);
      downloadJson(data, `gigome-my-data-${new Date().toISOString().slice(0, 10)}.json`);
      setState({ busy: false, message: 'account.downloaded', error: false });
    } catch {
      setState({ busy: false, message: 'account.dataError', error: true });
    }
  }
  return (
    <section className="account-section account-data" aria-labelledby="account-data-title">
      <h2 id="account-data-title">{t('account.dataTitle')}</h2>
      <p className="account-data-text">
        {isCompany
          ? t('account.dataTextCompany')
          : t('account.dataTextStudent')}
      </p>
      <button type="button" className="btn btn-secondary account-data-btn" onClick={onDownload} disabled={state.busy}>
        {state.busy ? t('account.preparing') : t('account.download')}
      </button>
      <p className={state.error ? 'err' : 'account-saved'} role={state.error ? 'alert' : 'status'}>{state.message && t(state.message)}</p>
    </section>
  );
}

function DeleteAccount({ isCompany, onLeaving }) {
  const navigate = useNavigate();
  const t = useT();
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
        <h2 id="delete-title">{t('account.deleteTitle')}</h2>
        <p className="account-danger-text">{t('account.deleteReminder')}</p>
        {kept && <p className="account-kept" role="status">{t('account.kept')}</p>}
        <div className="account-choice">
          <button type="button" className="btn btn-secondary" onClick={keep}>{t('account.keep')}</button>
          <button type="button" className="btn btn-secondary" onClick={() => { setKept(false); setStep('confirm'); }}>
            {t('account.delete')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="account-section account-danger" aria-labelledby="delete-title">
      <h2 id="delete-title">{t('account.deleteTitle')}</h2>
      <div className="account-danger-text">
        <p>
          {t('account.deleteBody')}{' '}
          {isCompany ? t('account.deleteBodyCompany') + ' ' : ''}
          <strong>{t('account.deleteUndone')}</strong>
        </p>
        <p className="muted">{t('account.deleteClicks')}</p>
      </div>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label className="field">
          {t('account.typeToConfirm', { word: CONFIRM_WORD })}
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
          <button type="button" className="btn btn-secondary" onClick={keep} disabled={busy}>{t('account.keep')}</button>
          <button type="submit" className="btn btn-secondary account-delete-btn" disabled={!confirmed || busy}>
            {busy ? t('account.deletingBtn') : t('account.delete')}
          </button>
        </div>
      </form>
    </section>
  );
}
