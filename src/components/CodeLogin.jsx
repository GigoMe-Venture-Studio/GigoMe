import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSession } from '../lib/useSession.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import {
  CODE_LENGTH,
  RESEND_SECONDS,
  fetchProfile,
  fetchUniversities,
  logOut,
  looksLikeEmail,
  normalizeEmail,
  sendCode,
  universityFor,
  universityNames,
  verifyCode
} from '../lib/auth.js';
import { mailtoHref } from '../lib/links.js';
import { fetchMyCompany } from '../lib/employer.js';
import { captchaEnabled } from '../lib/captcha.js';
import Turnstile from './Turnstile.jsx';

// The 6-digit email code login, used by /login (students) and /employers
// (companies). Same steps for both; what differs is which emails are
// accepted, the wording, and where people go afterwards.
//
//   audience 'student': only emails of a listed university get a code; after
//     login, /welcome when the profile has no name yet, otherwise `next`.
//   audience 'employer': any email except a listed university's (those are
//     sent to the student login); after login, /employers/setup when the
//     company account has no company yet, otherwise `next` or /dashboard.

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
  const [notListed, setNotListed] = useState(false);
  const [isStudentEmail, setIsStudentEmail] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [info, setInfo] = useState('');
  // Students: the universities whose emails can log in, shown on the email
  // step and listed again when an address is refused. Empty when they can't
  // be loaded (the form still works; the check on "Send me a code" reads them
  // again).
  const [universities, setUniversities] = useState([]);
  useEffect(() => {
    if (employer) return undefined;
    let active = true;
    fetchUniversities()
      .then((list) => active && setUniversities(list))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [employer]);
  // Turnstile (when VITE_TURNSTILE_SITE_KEY is set): every call to Supabase
  // Auth sends the current token, then the widget fetches a new one.
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const newCaptcha = () => setCaptchaReset((n) => n + 1);
  const captchaProps = {
    onToken: (t) => {
      setCaptchaToken(t);
      if (t) setCaptchaFailed(false);
    },
    onError: () => setCaptchaFailed(true),
    resetSignal: captchaReset
  };
  const waitingForCaptcha = captchaEnabled && !captchaToken;

  if (loading) return <p className="auth-card muted">Loading…</p>;
  if (finishing) return <p className="auth-card muted" role="status">Logging you in…</p>;
  if (session) return loggedIn ? loggedIn(session) : <LoggedIn email={session.user.email} next={next} />;

  async function onSubmitEmail(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setNotListed(false);
    setIsStudentEmail(false);
    setEmailInvalid(false);
    const value = normalizeEmail(email);
    if (!looksLikeEmail(value)) {
      setError(employer ? 'Enter your full email address, like name@company.it.' : 'Enter your full university email address, like name@university.it.');
      setEmailInvalid(true);
      return;
    }
    setBusy(true);
    try {
      let university;
      try {
        const list = await fetchUniversities();
        if (!employer) setUniversities(list);
        university = universityFor(value, list);
      } catch {
        setError("We couldn't check your email right now. Check your connection and try again.");
        return;
      }
      if (!employer && !university) {
        setNotListed(true);
        return;
      }
      if (employer && university) {
        setIsStudentEmail(true);
        return;
      }
      const sendError = await sendCode(value, captchaToken);
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
      setError(`Enter the ${CODE_LENGTH}-digit code from the email.`);
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
    navigate(await destination(audience, profile, result.user.id, next), { replace: true });
  }

  async function onResend() {
    setError('');
    setInfo('');
    setBusy(true);
    const sendError = await sendCode(email, captchaToken);
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
    setInfo('We sent you a new code. Only the newest code works.');
  }

  function onDifferentEmail() {
    writePending(audience, null);
    setStep('email');
    setCode('');
    setError('');
    setInfo('');
  }

  if (step === 'code') {
    return (
      <CodeStep
        email={email}
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
      <h1>{employer ? 'Employer login' : 'Log in or sign up'}</h1>
      <p className="lead">
        {employer ? 'Use your work email.' : 'Use your university email.'} We'll send you a{' '}
        <span className="nowrap">{CODE_LENGTH}-digit</span> code, no password needed.
      </p>
      {/* Naming a university here must never read as its endorsement: the
          line always says GigoMe isn't affiliated with any (CLAUDE.md). */}
      {!employer && universities.length > 0 && (
        <p className="auth-small login-unis">
          Open to students of {universityNames(universities)}. GigoMe is an independent student project, not run by
          or affiliated with any university.
        </p>
      )}
      <form className="auth-form" onSubmit={onSubmitEmail} noValidate>
        <label className="field">
          {employer ? 'Work email' : 'University email'}
          <input
            className="input"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck="false"
            placeholder={employer ? 'name@company.it' : 'name@university.it'}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setNotListed(false);
              setIsStudentEmail(false);
              setEmailInvalid(false);
            }}
            aria-invalid={emailInvalid || notListed || isStudentEmail}
            aria-describedby="login-privacy"
            autoFocus
            required
          />
        </label>
        <p className="auth-small" id="login-privacy">
          By continuing you agree to our <Link to="/privacy">privacy notice</Link>.
        </p>
        {error && <p className="err" role="alert">{error}</p>}
        {notListed && (
          <div className="note auth-notice" role="alert">
            {universities.length > 0 ? (
              <>
                <p>Use your university email. GigoMe is open to students of:</p>
                <ul className="uni-list">
                  {universities.map((u) => (
                    <li key={u.id}>
                      {u.name} <span className="uni-domains">({u.domains.map((d) => '@' + d).join(' or ')})</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Use your university email.</p>
            )}
            <p>
              Is your university missing?{' '}
              <a href={mailtoHref(CONTACT_EMAIL, 'Add my university to GigoMe')}>Email {CONTACT_EMAIL}</a>
            </p>
            <p>
              Are you an employer? <Link to="/employers">Log in on the employers page</Link>.
            </p>
          </div>
        )}
        {isStudentEmail && (
          <div className="note auth-notice" role="alert">
            <p>
              That's a university email. Students <Link to="/login">log in here</Link>.
            </p>
            <p>
              Hiring for a company? Use your work email instead.
            </p>
          </div>
        )}
        <CaptchaCheck props={captchaProps} failed={captchaFailed} waiting={waitingForCaptcha} />
        <button type="submit" className="btn btn-primary" disabled={busy || waitingForCaptcha}>
          {busy ? 'Checking…' : 'Send me a code'}
        </button>
      </form>
    </div>
  );
}

// The Turnstile widget plus what to tell the person while it works or if it
// can't load. Renders nothing when Turnstile isn't configured.
function CaptchaCheck({ props, failed, waiting }) {
  if (!captchaEnabled) return null;
  return (
    <div className="captcha-check">
      <Turnstile {...props} />
      {failed ? (
        <p className="err" role="alert">
          We couldn't load the check that keeps bots out. Reload the page, or try another browser or network.
        </p>
      ) : (
        waiting && <p className="auth-small" role="status">One moment: checking you're not a bot…</p>
      )}
    </div>
  );
}

function CodeStep({ email, sentAt, code, setCode, busy, error, info, onVerify, onResend, onDifferentEmail, captcha, waitingForCaptcha }) {
  const inputRef = useRef(null);
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
      <h1>Check your email</h1>
      <p className="lead">
        We sent a <span className="nowrap">{CODE_LENGTH}-digit</span> code to <strong className="auth-email">{email}</strong>.
      </p>
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          onVerify(code);
        }}
        noValidate
      >
        <label className="field">
          Your code
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
        <p className="auth-small" id="code-hint">
          It can take a minute to arrive. Not there? Check your spam or junk folder.
        </p>
        {error && <p className="err" role="alert">{error}</p>}
        {info && !error && <p className="auth-small" role="status">{info}</p>}
        {captcha}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Checking…' : 'Log in'}
        </button>
      </form>
      <div className="auth-links">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onResend} disabled={busy || waitLeft > 0 || waitingForCaptcha}>
          {waitLeft > 0 ? `Send a new code (${waitLeft}s)` : 'Send a new code'}
        </button>
        <button type="button" className="btn-link" onClick={onDifferentEmail} disabled={busy}>
          Use a different email
        </button>
      </div>
    </div>
  );
}

export function LoggedIn({ email, next }) {
  const [error, setError] = useState('');
  return (
    <div className="auth-card">
      <h1>You're logged in</h1>
      <p className="lead">
        Logged in as <strong className="auth-email">{email}</strong>.
      </p>
      <div className="auth-buttons">
        <Link className="btn btn-primary" to={next || '/'}>{next ? 'Continue' : 'Go to GigoMe'}</Link>
        <button type="button" className="btn btn-secondary" onClick={async () => setError((await logOut()) || '')}>
          Log out
        </button>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}

// Where to go after the code is accepted.
async function destination(audience, profile, userId, next) {
  if (audience !== 'employer') {
    return profile && profile.full_name ? next || '/' : '/welcome' + (next ? '?next=' + encodeURIComponent(next) : '');
  }
  // A student account (its email domain became a university's) has no dashboard.
  if (profile && profile.account_type !== 'company') return '/';
  try {
    const company = await fetchMyCompany(userId, { withEmail: false });
    if (!company) return '/employers/setup';
  } catch {
    /* the dashboard loads the company again and shows any error */
  }
  return next || '/dashboard';
}
