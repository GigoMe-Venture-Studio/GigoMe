import { useEffect, useRef, useState } from 'react';
import LogOutButton from './LogOutButton.jsx';
import { Link, useNavigate } from 'react-router';
import { useSession } from '../lib/useSession.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import {
  CODE_LENGTH,
  RESEND_SECONDS,
  fetchProfile,
  fetchUniversities,
  looksLikeEmail,
  needsStudentAnswers,
  normalizeEmail,
  sendCode,
  universityFor,
  verifyCode
} from '../lib/auth.js';
import { mailtoHref } from '../lib/links.js';
import { fetchMyCompany } from '../lib/employer.js';
import { hasAcceptedTerms } from '../lib/terms.js';
import { captchaEnabled } from '../lib/captcha.js';
import Turnstile from './Turnstile.jsx';
import { useT } from '../lib/useLang.js';

// The 6-digit email code login, used by /login (students) and /employers
// (companies). Same steps for both; what differs is which emails are
// accepted, the wording, and where people go afterwards.
//
//   audience 'student': any email gets a code, sent with signup_as 'student'
//     (sendCode): the database makes a new account a student, verified when
//     the domain is a listed university's. After login, /welcome when the
//     profile has no name yet, the current Terms aren't accepted or a
//     self-declared student hasn't said which university; otherwise `next`.
//     An email that already has a company account stays one (one email, one
//     role): LoggedIn says so and points to the employer login.
//   audience 'employer': any email except a listed university's (those are
//     sent to the student login); after login, /employers/setup when the
//     company account has no company yet, otherwise `next` or /dashboard. A
//     student account is told so by the page's loggedIn (Employers.jsx).

// Remembers the email a code was sent to, so a student who switches to their
// mail app and back (and whose browser reloads the tab) lands on the code step.
const PENDING_KEY = 'gigome.login.pending';
const pendingKey = (audience) => (audience === 'employer' ? PENDING_KEY + '.employer' : PENDING_KEY);
function readPending(audience) {
  try {
    const p = JSON.parse(sessionStorage.getItem(pendingKey(audience)) || 'null');
    return p && p.email && p.sentAt ? p : null;
  } catch {
    return null;
  }
}
function writePending(audience, p) {
  try {
    if (p) sessionStorage.setItem(pendingKey(audience), JSON.stringify(p));
    else sessionStorage.removeItem(pendingKey(audience));
  } catch {
    /* storage blocked: the student just starts again */
  }
}

export default function CodeLogin({ audience = 'student', next = '', loggedIn }) {
  const navigate = useNavigate();
  const t = useT();
  const { session, loading } = useSession();
  const pending = useRef(readPending(audience)).current;
  const employer = audience === 'employer';

  const [step, setStep] = useState(pending ? 'code' : 'email');
  const [email, setEmail] = useState(pending ? pending.email : '');
  const [sentAt, setSentAt] = useState(pending ? pending.sentAt : 0);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');
  const [isStudentEmail, setIsStudentEmail] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [info, setInfo] = useState('');
  // Students: the universities whose emails verify a student, read when
  // "Which emails verify you as a student?" is opened. Never on page load.
  const [universities, setUniversities] = useState([]);
  const [uniListState, setUniListState] = useState('idle'); // idle | loading | ready | error
  // Turnstile (when VITE_TURNSTILE_SITE_KEY is set): every call to Supabase
  // Auth sends the current token, then the widget fetches a new one.
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const newCaptcha = () => setCaptchaReset((n) => n + 1);
  const captchaProps = {
    onToken: (token) => {
      setCaptchaToken(token);
      if (token) setCaptchaFailed(false);
    },
    onError: () => setCaptchaFailed(true),
    resetSignal: captchaReset
  };
  const waitingForCaptcha = captchaEnabled && !captchaToken;

  if (loading) return <p className="auth-card muted">{t('common.loading')}</p>;
  if (finishing) return <p className="auth-card muted" role="status">{t('codeLogin.loggingIn')}</p>;
  if (session) return loggedIn ? loggedIn(session) : <LoggedIn userId={session.user.id} email={session.user.email} next={next} />;

  // "Which emails verify you as a student?": the list, read once when first opened.
  async function onUniListToggle(e) {
    if (!e.currentTarget.open || uniListState === 'ready' || uniListState === 'loading') return;
    setUniListState('loading');
    try {
      setUniversities(await fetchUniversities());
      setUniListState('ready');
    } catch {
      setUniListState('error');
    }
  }

  async function onSubmitEmail(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setIsStudentEmail(false);
    setEmailInvalid(false);
    const value = normalizeEmail(email);
    if (!looksLikeEmail(value)) {
      setError(employer ? t('codeLogin.errFullEmailEmployer') : t('codeLogin.errFullEmailStudent'));
      setEmailInvalid(true);
      return;
    }
    setBusy(true);
    try {
      // Employers: a listed university's email is a student's (the database
      // would make it a student account), so send them to the student login.
      if (employer) {
        let university;
        try {
          university = universityFor(value, await fetchUniversities());
        } catch {
          setError(t('codeLogin.errCheckEmail'));
          return;
        }
        if (university) {
          setIsStudentEmail(true);
          return;
        }
      }
      const sendError = await sendCode(value, captchaToken, { asStudent: !employer });
      newCaptcha();
      if (sendError) {
        setError(sendError);
        return;
      }
      const now = Date.now();
      setEmail(value);
      setSentAt(now);
      setCode('');
      setStep('code');
      writePending(audience, { email: value, sentAt: now });
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(value) {
    if (busy) return;
    setError('');
    setInfo('');
    if (value.length !== CODE_LENGTH) {
      setError(t('codeLogin.errCodeLength', { n: CODE_LENGTH }));
      return;
    }
    setBusy(true);
    const result = await verifyCode(email, value, sentAt, captchaToken);
    newCaptcha();
    if (result.error) {
      setBusy(false);
      setError(result.error);
      setCode('');
      return;
    }
    setFinishing(true);
    writePending(audience, null);
    let profile = null;
    try {
      profile = await fetchProfile(result.user.id);
    } catch {
      /* the welcome page loads the profile again and shows any error */
    }
    const to = await destination(audience, profile, result.user.id, next);
    if (!to) {
      // The other role's account (one email, one role): the logged-in view
      // (LoggedIn, or the employer page's loggedIn) says so.
      setFinishing(false);
      setBusy(false);
      return;
    }
    navigate(to, { replace: true });
  }

  async function onResend() {
    setError('');
    setInfo('');
    setBusy(true);
    const sendError = await sendCode(email, captchaToken, { asStudent: !employer });
    newCaptcha();
    setBusy(false);
    if (sendError) {
      setError(sendError);
      return;
    }
    const now = Date.now();
    setSentAt(now);
    setCode('');
    writePending(audience, { email, sentAt: now });
    setInfo(t('codeLogin.newCodeSent'));
  }

  function onDifferentEmail() {
    writePending(audience, null);
    setStep('email');
    setCode('');
    setError('');
    setInfo('');
  }

  // "6-digit", kept on one line.
  const digitCode = <span className="nowrap">{t('codeLogin.digitCode', { n: CODE_LENGTH })}</span>;

  if (step === 'code') {
    return (
      <CodeStep
        email={email}
        digitCode={digitCode}
        sentAt={sentAt}
        code={code}
        setCode={setCode}
        busy={busy}
        error={error}
        info={info}
        onVerify={onVerify}
        onResend={onResend}
        onDifferentEmail={onDifferentEmail}
        captcha={<CaptchaCheck props={captchaProps} failed={captchaFailed} waiting={waitingForCaptcha} />}
        waitingForCaptcha={waitingForCaptcha}
      />
    );
  }

  return (
    <div className="auth-card">
      <h1>{employer ? t('codeLogin.titleEmployer') : t('codeLogin.titleStudent')}</h1>
      <p className="lead">{t(employer ? 'codeLogin.leadEmployer' : 'codeLogin.leadStudent', { code: digitCode })}</p>
      {/* This line is always on the student login, above the only place a
          university is named: "Which emails verify you as a student?"
          (folded, CLAUDE.md). */}
      {/* Which login is which: the other one, in one line. */}
      <p className="auth-small login-switch">
        {employer
          ? t('codeLogin.switchEmployer', { link: (s) => <Link to="/login">{s}</Link> })
          : t('codeLogin.switchStudent', { link: (s) => <Link to="/employers">{s}</Link> })}
      </p>
      {!employer && (
        <p className="auth-small login-disclaimer">{t('codeLogin.disclaimer')}</p>
      )}
      {!employer && (
        <details className="uni-details" onToggle={onUniListToggle}>
          <summary className="tap-44">{t('codeLogin.uniSummary')}</summary>
          <div className="uni-details-body">
            {uniListState === 'ready' && universities.length > 0 && (
              <>
                <p>{t('codeLogin.uniListIntro')}</p>
                <UniversityList universities={universities} />
              </>
            )}
            {uniListState === 'loading' && <p className="muted" role="status">{t('common.loading')}</p>}
            {uniListState === 'error' && <p role="alert">{t('codeLogin.uniListError')}</p>}
            <p>{t('codeLogin.uniOtherEmail')}</p>
            <p>
              {t('codeLogin.uniMissing')}{' '}
              <a href={mailtoHref(CONTACT_EMAIL, t('codeLogin.uniMissingSubject'))}>{t('codeLogin.uniMissingLink', { email: CONTACT_EMAIL })}</a>
            </p>
          </div>
        </details>
      )}
      <form className="auth-form" onSubmit={onSubmitEmail} noValidate>
        <label className="field">
          {employer ? t('codeLogin.labelWorkEmail') : t('codeLogin.labelEmail')}
          <input
            className="input"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck="false"
            placeholder={employer ? t('codeLogin.placeholderEmployer') : t('codeLogin.placeholderStudent')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setIsStudentEmail(false);
              setEmailInvalid(false);
            }}
            aria-invalid={emailInvalid || isStudentEmail}
            aria-describedby="login-privacy"
            /* Not on /employers: the form is under the pitch there, and focusing
               it would scroll the pitch out of sight on phones. */
            autoFocus={!employer}
            required
          />
        </label>
        <p className="auth-small" id="login-privacy">
          {t(employer ? 'codeLogin.privacyEmployer' : 'codeLogin.privacyStudent', { link: (s) => <Link to="/privacy">{s}</Link> })}
        </p>
        {error && <p className="err" role="alert">{error}</p>}
        {isStudentEmail && (
          <div className="note auth-notice" role="alert">
            <p>{t('codeLogin.uniEmailNotice', { link: (s) => <Link to="/login">{s}</Link> })}</p>
            <p>{t('codeLogin.uniEmailHiring')}</p>
          </div>
        )}
        <CaptchaCheck props={captchaProps} failed={captchaFailed} waiting={waitingForCaptcha} />
        <button type="submit" className="btn btn-primary" disabled={busy || waitingForCaptcha}>
          {busy ? t('codeLogin.checking') : t('codeLogin.sendCode')}
        </button>
      </form>
    </div>
  );
}

// The Turnstile widget plus what to tell the person while it works or if it
// can't load. Renders nothing when Turnstile isn't configured.
function CaptchaCheck({ props, failed, waiting }) {
  const t = useT();
  if (!captchaEnabled) return null;
  return (
    <div className="captcha-check">
      <Turnstile {...props} />
      {failed ? (
        <p className="err" role="alert">{t('codeLogin.captchaFailed')}</p>
      ) : (
        waiting && <p className="auth-small" role="status">{t('codeLogin.captchaWaiting')}</p>
      )}
    </div>
  );
}

function CodeStep({ email, digitCode, sentAt, code, setCode, busy, error, info, onVerify, onResend, onDifferentEmail, captcha, waitingForCaptcha }) {
  const inputRef = useRef(null);
  const t = useT();
  const [now, setNow] = useState(Date.now());
  const waitLeft = Math.max(0, Math.ceil((sentAt + RESEND_SECONDS * 1000 - now) / 1000));

  useEffect(() => {
    if (waitLeft <= 0) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waitLeft]);

  useEffect(() => {
    if (!busy && inputRef.current) inputRef.current.focus();
  }, [busy, error, sentAt]);

  function onChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    // Submit as soon as the last digit is typed or the code is pasted.
    if (digits.length === CODE_LENGTH) onVerify(digits);
  }

  return (
    <div className="auth-card">
      <h1>{t('codeLogin.checkEmail')}</h1>
      <p className="lead">{t('codeLogin.sentTo', { code: digitCode, email: <strong className="auth-email">{email}</strong> })}</p>
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          onVerify(code);
        }}
        noValidate
      >
        <label className="field">
          {t('codeLogin.yourCode')}
          <input
            ref={inputRef}
            className="input code-input"
            type="text"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH + 4}
            value={code}
            onChange={onChange}
            disabled={busy}
            aria-invalid={Boolean(error)}
            aria-describedby="code-hint"
          />
        </label>
        <p className="auth-small" id="code-hint">{t('codeLogin.codeHint')}</p>
        {error && <p className="err" role="alert">{error}</p>}
        {info && !error && <p className="auth-small" role="status">{info}</p>}
        {captcha}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('codeLogin.checking') : t('codeLogin.logIn')}
        </button>
      </form>
      <div className="auth-links">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onResend} disabled={busy || waitLeft > 0 || waitingForCaptcha}>
          {waitLeft > 0 ? t('codeLogin.resendWait', { s: waitLeft }) : t('codeLogin.resend')}
        </button>
        <button type="button" className="btn-link tap-44" onClick={onDifferentEmail} disabled={busy}>
          {t('codeLogin.differentEmail')}
        </button>
      </div>
    </div>
  );
}

// The student login when already logged in. An email with a company account
// stays one (one email, one role): say so and point to the employer login.
export function LoggedIn({ userId, email, next }) {
  const t = useT();
  const [error, setError] = useState('');
  const [type, setType] = useState('');
  useEffect(() => {
    let active = true;
    fetchProfile(userId)
      .then((p) => active && setType((p && p.account_type) || 'student'))
      .catch(() => active && setType('student'));
    return () => {
      active = false;
    };
  }, [userId]);
  if (!type) return <p className="auth-card muted">{t('common.loading')}</p>;
  if (type === 'company') {
    return (
      <div className="auth-card wrong-role">
        <h1>{t('codeLogin.wrongRoleTitle')}</h1>
        <p className="lead">{t('codeLogin.wrongRoleLead', { email: <strong className="auth-email">{email}</strong> })}</p>
        <p>{t('codeLogin.wrongRoleHelp', { link: (s) => <Link to="/employers">{s}</Link> })}</p>
        <div className="auth-buttons">
          <Link className="btn btn-primary" to="/employers">{t('codeLogin.goEmployerLogin')}</Link>
          <LogOutButton className="btn btn-secondary" onError={setError} />
        </div>
        {error && <p className="err" role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <div className="auth-card">
      <h1>{t('codeLogin.loggedInTitle')}</h1>
      <p className="lead">{t('codeLogin.loggedInAs', { email: <strong className="auth-email">{email}</strong> })}</p>
      <div className="auth-buttons">
        <Link className="btn btn-primary" to={next || '/'}>{next ? t('codeLogin.continue') : t('codeLogin.goHome')}</Link>
        <LogOutButton className="btn btn-secondary" onError={setError} />
      </div>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}

// Where to go after the code is accepted.
// null: the account has the other role (one email, one role); stay and say so.
async function destination(audience, profile, userId, next) {
  if (audience !== 'employer') {
    if (profile && profile.account_type === 'company') return null;
    return profile && profile.full_name && hasAcceptedTerms(profile) && !needsStudentAnswers(profile)
      ? next || '/'
      : '/welcome' + (next ? '?next=' + encodeURIComponent(next) : '');
  }
  // A student account has no dashboard: the employer page's loggedIn says so.
  if (profile && profile.account_type !== 'company') return null;
  try {
    const company = await fetchMyCompany(userId, { withEmail: false });
    if (!company) return '/employers/setup';
  } catch {
    /* the dashboard loads the company again and shows any error */
  }
  return next || '/dashboard';
}

// The universities whose student emails verify a student, each with its
// domains: "Bocconi University (@studbocconi.it)".
function UniversityList({ universities }) {
  const t = useT();
  return (
    <ul className="uni-list">
      {universities.map((u) => (
        <li key={u.id}>
          {u.name} <span className="uni-domains">({u.domains.map((d) => '@' + d).join(' ' + t('common.or') + ' ')})</span>
        </li>
      ))}
    </ul>
  );
}
