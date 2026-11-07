import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import {
  CODE_LENGTH,
  RESEND_SECONDS,
  fetchProfile,
  findUniversity,
  logOut,
  looksLikeEmail,
  normalizeEmail,
  safeNext,
  sendCode,
  verifyCode
} from '../lib/auth.js';

// Remembers the email a code was sent to, so a student who switches to their
// mail app and back (and whose browser reloads the tab) lands on the code step.
const PENDING_KEY = 'gigome.login.pending';
function readPending() {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
    return p && p.email && p.sentAt ? p : null;
  } catch {
    return null;
  }
}
function writePending(p) {
  try {
    if (p) sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage blocked: the student just starts again */
  }
}

export default function Login() {
  return <PageShell>{supabase ? <LoginFlow /> : <ConfigError />}</PageShell>;
}

function LoginFlow() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { session, loading } = useSession();
  const pending = useRef(readPending()).current;

  const [step, setStep] = useState(pending ? 'code' : 'email');
  const [email, setEmail] = useState(pending ? pending.email : '');
  const [sentAt, setSentAt] = useState(pending ? pending.sentAt : 0);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');
  const [notListed, setNotListed] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [info, setInfo] = useState('');

  if (loading) return <p className="auth-card muted">Loading…</p>;
  if (finishing) return <p className="auth-card muted" role="status">Logging you in…</p>;
  if (session) return <LoggedIn email={session.user.email} next={next} />;

  async function onSubmitEmail(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setNotListed(false);
    setEmailInvalid(false);
    const value = normalizeEmail(email);
    if (!looksLikeEmail(value)) {
      setError('Enter your full university email address, like name@university.it.');
      setEmailInvalid(true);
      return;
    }
    setBusy(true);
    try {
      let university;
      try {
        university = await findUniversity(value);
      } catch {
        setError("We couldn't check your email right now. Check your connection and try again.");
        return;
      }
      if (!university) {
        setNotListed(true);
        return;
      }
      const sendError = await sendCode(value);
      if (sendError) {
        setError(sendError);
        return;
      }
      const now = Date.now();
      setEmail(value);
      setSentAt(now);
      setCode('');
      setStep('code');
      writePending({ email: value, sentAt: now });
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
    const result = await verifyCode(email, value, sentAt);
    if (result.error) {
      setBusy(false);
      setError(result.error);
      setCode('');
      return;
    }
    setFinishing(true);
    writePending(null);
    let profile = null;
    try {
      profile = await fetchProfile(result.user.id);
    } catch {
      /* the welcome page loads the profile again and shows any error */
    }
    const after = next || '/';
    navigate(profile && profile.full_name ? after : '/welcome' + (next ? '?next=' + encodeURIComponent(next) : ''), {
      replace: true
    });
  }

  async function onResend() {
    setError('');
    setInfo('');
    setBusy(true);
    const sendError = await sendCode(email);
    setBusy(false);
    if (sendError) {
      setError(sendError);
      return;
    }
    const now = Date.now();
    setSentAt(now);
    setCode('');
    writePending({ email, sentAt: now });
    setInfo('We sent you a new code. Only the newest code works.');
  }

  function onDifferentEmail() {
    writePending(null);
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
      />
    );
  }

  return (
    <div className="auth-card">
      <h1>Log in or sign up</h1>
      <p className="lead">
        Use your university email. We'll send you a <span className="nowrap">{CODE_LENGTH}-digit</span> code, no
        password needed.
      </p>
      <form className="auth-form" onSubmit={onSubmitEmail} noValidate>
        <label className="field">
          University email
          <input
            className="input"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="name@university.it"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setNotListed(false);
              setEmailInvalid(false);
            }}
            aria-invalid={emailInvalid || notListed}
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
            <p>
              Use your university email. If your university isn't on GigoMe yet, tell us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
            <p>
              Are you a company? Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Checking…' : 'Send me a code'}
        </button>
      </form>
    </div>
  );
}

function CodeStep({ email, sentAt, code, setCode, busy, error, info, onVerify, onResend, onDifferentEmail }) {
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
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Checking…' : 'Log in'}
        </button>
      </form>
      <div className="auth-links">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onResend} disabled={busy || waitLeft > 0}>
          {waitLeft > 0 ? `Send a new code (${waitLeft}s)` : 'Send a new code'}
        </button>
        <button type="button" className="btn-link" onClick={onDifferentEmail} disabled={busy}>
          Use a different email
        </button>
      </div>
    </div>
  );
}

function LoggedIn({ email, next }) {
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
