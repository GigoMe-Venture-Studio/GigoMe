import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import ProfileFields from '../components/ProfileFields.jsx';
import TermsCheckbox from '../components/TermsCheckbox.jsx';
import { StudentReady } from '../components/SignupDone.jsx';
import {
  declareStudent,
  fetchProfile,
  fetchUniversities,
  needsStudentAnswers,
  safeNext,
  saveProfile
} from '../lib/auth.js';
import { deleteMyAccount, endDeletedSession } from '../lib/account.js';
import LogOutButton from '../components/LogOutButton.jsx';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { announceProfileChange, checkProfile } from '../lib/profile.js';
import { TERMS_REQUIRED, acceptTerms, hasAcceptedTerms } from '../lib/terms.js';

// /welcome: a new student's name, degree and graduation year, and for every
// account (students and companies) the Terms ("I'm 18 or older and I accept
// the Terms") until the current version is accepted. TermsGate sends
// accounts here, with ?next= the page they asked for. A new student's first
// save (no name yet) ends on the confirmation (StudentReady), once; accepting
// a new Terms version goes straight on to ?next=.
//
// A student who signed up with an email that isn't a listed university's
// (student_verification 'self_declared') also answers, once: "Are you
// currently a university student?" and "Which university?" (a listed one, or
// "Other" with its name; declare_student). "No" creates no student account:
// the account the login just made is deleted (delete_my_account) and the page
// says what they can do instead. University emails skip both questions.
export default function Welcome() {
  return <PageShell>{supabase ? <WelcomeGate /> : <ConfigError />}</PageShell>;
}

function WelcomeGate() {
  const { session, loading } = useSession();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  // "No, I'm not a student": the account is deleted and the session ends;
  // show why instead of sending them to the login.
  const [notStudent, setNotStudent] = useState(false);
  if (notStudent && !session) return <NotAStudent />;
  if (loading) return <p className="auth-card muted">Loading…</p>;
  if (!session) return <Navigate to={'/login' + (next ? '?next=' + encodeURIComponent(next) : '')} replace />;
  return <WelcomeForm user={session.user} next={next} onNotStudent={() => setNotStudent(true)} />;
}

const OTHER = 'other';

function WelcomeForm({ user, next, onNotStudent }) {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [fullName, setFullName] = useState('');
  const [degree, setDegree] = useState('');
  const [year, setYear] = useState('');
  // What this account still has to give: its details (a student without a
  // name), the Terms, and a self-declared student's answers.
  const [needs, setNeeds] = useState({ profile: false, terms: true, answers: false });
  const [termsTicked, setTermsTicked] = useState(false);
  const [isStudent, setIsStudent] = useState(''); // '' | 'yes' | 'no'
  const [universities, setUniversities] = useState(null);
  const [uniChoice, setUniChoice] = useState(''); // a university id, OTHER or ''
  const [otherName, setOtherName] = useState('');
  const [declared, setDeclared] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  // firstTime: a student signing up (no name yet). done: their first name,
  // once saved, to show the confirmation.
  const [firstTime, setFirstTime] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    let active = true;
    fetchProfile(user.id)
      .then(async (p) => {
        const answers = needsStudentAnswers(p);
        // The dropdown: every listed university, by name.
        const list = answers ? await fetchUniversities() : null;
        if (!active) return;
        if (p) {
          setFullName(p.full_name || '');
          setDegree(p.degree_level || '');
          setYear(p.graduation_year ? String(p.graduation_year) : '');
        }
        const student = Boolean(p) && p.account_type === 'student';
        setFirstTime(student && !p.full_name);
        setUniversities(list);
        setNeeds({ profile: student && !p.full_name, terms: !hasAcceptedTerms(p), answers });
        setLoaded(true);
      })
      .catch(() => active && setLoadError("We couldn't load your profile. Check your connection and reload the page."));
    return () => {
      active = false;
    };
  }, [user.id]);

  // The questions are asked and "No" is chosen: nothing else is asked.
  const declining = needs.answers && isStudent === 'no';

  async function onSubmit(e) {
    e.preventDefault();
    setSaveError('');
    if (declining) return onDecline();
    let fields = null;
    let found = {};
    let answer = null;
    if (needs.answers) {
      if (!isStudent) found.isStudent = 'Choose Yes or No.';
      else if (!uniChoice) found.university = 'Choose your university, or "Other".';
      else if (uniChoice === OTHER) {
        const name = otherName.trim().replace(/\s+/g, ' ');
        if (name.length < 2) found.otherName = "Type your university's name.";
        else answer = { otherName: name };
      } else answer = { universityId: uniChoice };
    }
    if (needs.profile) {
      const checked = checkProfile({ fullName, degree, year });
      found = { ...found, ...checked.errors };
      fields = checked.fields;
    }
    if (needs.terms && !termsTicked) found = { ...found, terms: TERMS_REQUIRED };
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      if (fields) await saveProfile(user.id, fields);
      // Recorded once: if a later step fails, a second try skips it.
      if (answer && !declared) {
        await declareStudent(answer);
        setDeclared(true);
      }
      if (needs.terms) await acceptTerms(user.id);
      announceProfileChange();
      if (firstTime && fields) {
        setDone(fields.full_name.split(' ')[0]);
        return;
      }
      navigate(next || '/', { replace: true });
    } catch {
      setSaveError(needs.profile || needs.answers
        ? "We couldn't save your details. Check your connection and try again."
        : "We couldn't save that. Check your connection and try again.");
      setBusy(false);
    }
  }

  // "No": the account the login created is deleted, so no student account
  // exists; then this device's session ends and NotAStudent explains.
  async function onDecline() {
    setBusy(true);
    const error = await deleteMyAccount();
    if (error) {
      setSaveError("We couldn't finish this. Check your connection and try again.");
      setBusy(false);
      return;
    }
    onNotStudent();
    await endDeletedSession();
  }

  if (done) return <StudentReady firstName={done} email={user.email} next={next} />;
  if (loadError) return <p className="auth-card err" role="alert">{loadError}</p>;
  if (!loaded) return <p className="auth-card muted">Loading…</p>;

  const termsOnly = !needs.profile && !needs.answers;

  return (
    <div className="auth-card">
      <p className="auth-small">
        Logged in as <strong className="auth-email">{user.email}</strong> ·{' '}
        <LogOutButton className="btn-link" onError={setSaveError} />
      </p>
      {termsOnly ? (
        <>
          <h1 className="auth-title-gap">Before you continue</h1>
          <p className="lead">To use GigoMe, please confirm the following. We only ask once.</p>
        </>
      ) : (
        <>
          <h1 className="auth-title-gap">Welcome to GigoMe</h1>
          <p className="lead">
            Tell us a little about yourself.{needs.profile ? ' You can change your details later.' : ''}
          </p>
        </>
      )}
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {needs.answers && (
          <StudentQuestions
            isStudent={isStudent}
            setIsStudent={(v) => {
              setIsStudent(v);
              setErrors({});
            }}
            universities={universities || []}
            uniChoice={uniChoice}
            setUniChoice={setUniChoice}
            otherName={otherName}
            setOtherName={setOtherName}
            errors={errors}
          />
        )}
        {declining ? (
          <div className="note auth-notice not-student" role="status">
            <p>
              GigoMe is for university students, so we won't create a student account for{' '}
              <strong className="auth-email">{user.email}</strong>.
            </p>
            <p>You can still browse every job without an account.</p>
            <p>
              Hiring? Use the <Link to="/employers">employer login</Link>.
            </p>
          </div>
        ) : (
          <>
            {needs.profile && (
              <ProfileFields
                values={{ fullName, degree, year }}
                onChange={(key, value) => ({ fullName: setFullName, degree: setDegree, year: setYear })[key](value)}
                errors={errors}
              />
            )}
            {needs.terms && <TermsCheckbox checked={termsTicked} onChange={setTermsTicked} error={errors.terms} />}
          </>
        )}
        {saveError && <p className="err" role="alert">{saveError}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {declining
            ? busy ? 'One moment…' : "Don't create my account"
            : busy ? 'Saving…' : termsOnly ? 'Continue' : 'Save and continue'}
        </button>
      </form>
    </div>
  );
}

// "Are you currently a university student?" and, for Yes, "Which
// university?": the listed universities and "Other" with a name.
function StudentQuestions({ isStudent, setIsStudent, universities, uniChoice, setUniChoice, otherName, setOtherName, errors }) {
  return (
    <>
      <fieldset className="student-question" aria-invalid={Boolean(errors.isStudent)}>
        <legend>Are you currently a university student?</legend>
        <div className="student-question-options">
          {[['yes', 'Yes'], ['no', 'No']].map(([value, label]) => (
            <label key={value} className="check">
              <input type="radio" name="is_student" value={value} checked={isStudent === value} onChange={() => setIsStudent(value)} />{' '}
              {label}
            </label>
          ))}
        </div>
        {errors.isStudent && <span className="err">{errors.isStudent}</span>}
      </fieldset>
      {isStudent === 'yes' && (
        <>
          <label className="field">
            Which university?
            <select
              className="select"
              name="university"
              value={uniChoice}
              onChange={(e) => setUniChoice(e.target.value)}
              aria-invalid={Boolean(errors.university)}
              required
            >
              <option value="">Choose…</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
              <option value={OTHER}>Other</option>
            </select>
            {errors.university && <span className="err">{errors.university}</span>}
          </label>
          {uniChoice === OTHER && (
            <label className="field">
              Your university's name
              <input
                className="input"
                type="text"
                name="other_university"
                maxLength={200}
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                aria-invalid={Boolean(errors.otherName)}
                required
              />
              {errors.otherName && <span className="err">{errors.otherName}</span>}
            </label>
          )}
          <p className="auth-small">
            You can't change this yourself later. If it's wrong, write to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </>
      )}
    </>
  );
}

// After "No": the account is gone and this device is logged out.
function NotAStudent() {
  return (
    <div className="auth-card">
      <h1>GigoMe is for university students</h1>
      <p className="lead">We haven't created a student account, and we've deleted the login we started for your email.</p>
      <p>You can still browse every job on GigoMe without an account.</p>
      <div className="auth-buttons">
        <Link className="btn btn-primary" to="/jobs">Browse jobs</Link>
        <Link className="btn btn-secondary" to="/employers">Hiring? Employer login</Link>
      </div>
    </div>
  );
}
