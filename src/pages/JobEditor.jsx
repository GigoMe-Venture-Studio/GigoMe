import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import EmployerGate from '../components/EmployerGate.jsx';
import { supabase } from '../lib/supabase.js';
import { looksLikeEmail, normalizeEmail } from '../lib/auth.js';
import { useCompanyAccount } from '../lib/useCompanyAccount.js';
import { CATEGORIES, ITALIAN_LABEL, JOB_TYPES } from '../lib/jobs.js';
import { HOURS_HINT_ABOVE, JOB_STATUS, fetchMyJob, normalizeUrl, saveJob } from '../lib/employer.js';
import { fetchAreas } from '../lib/areas.js';
import { findAddress } from '../lib/geocode.js';

// The pin map is only downloaded when it is shown.
const LocationPicker = lazy(() => import('../components/LocationPicker.jsx'));
const MILAN = [9.19, 45.4642];

// /dashboard/jobs/new and /dashboard/jobs/:id/edit
export default function JobEditor() {
  return <PageShell className="dashboard-main">{supabase ? <EditorPage /> : <ConfigError />}</PageShell>;
}

function EditorPage() {
  const { id } = useParams();
  const account = useCompanyAccount();
  const here = id ? `/dashboard/jobs/${id}/edit` : '/dashboard/jobs/new';
  const gate = <EmployerGate account={account} here={here} />;
  if (account.status !== 'ready') return gate;
  return id ? <LoadJob company={account.company} id={id} /> : <JobForm company={account.company} job={null} />;
}

function LoadJob({ company, id }) {
  const [state, setState] = useState({ status: 'loading', job: null });
  useEffect(() => {
    let active = true;
    fetchMyJob(company.id, id)
      .then((job) => active && setState({ status: job ? 'ready' : 'missing', job }))
      .catch(() => active && setState({ status: 'error', job: null }));
    return () => {
      active = false;
    };
  }, [company.id, id]);

  if (state.status === 'loading') return <p className="muted">Loading the job…</p>;
  if (state.status === 'error') return <p className="err" role="alert">We couldn't load this job. Check your connection and reload the page.</p>;
  if (state.status === 'missing') {
    return (
      <div className="empty-state page-empty">
        <BackLink />
        <h1 className="page-title">Job not found</h1>
        <p className="muted">It may have been deleted, or it belongs to another company.</p>
      </div>
    );
  }
  if (state.job.status === 'rejected') {
    return (
      <div className="empty-state page-empty">
        <BackLink />
        <h1 className="page-title">{state.job.title}</h1>
        <p>This job was rejected, so it can't be edited or submitted again.</p>
        {state.job.review_note && <p className="muted job-text">Note from the reviewer: {state.job.review_note}</p>}
      </div>
    );
  }
  return <JobForm company={company} job={state.job} />;
}

function BackLink() {
  return (
    <Link className="back" to="/dashboard">
      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
      Dashboard
    </Link>
  );
}

// YYYY-MM-DD (local) for a timestamp, and back to the end of that local day.
function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function endOfDay(dateInput) {
  const [y, m, d] = dateInput.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
}
const today = () => toDateInput(new Date().toISOString());

function JobForm({ company, job }) {
  const navigate = useNavigate();
  const [v, setV] = useState(() => ({
    title: job ? job.title : '',
    jobType: job ? job.job_type : '',
    category: job ? job.category || 'other' : '',
    description: job ? job.description || '' : '',
    location: job ? job.location || '' : '',
    remote: job ? job.remote : false,
    hours: job ? String(job.hours_per_week) : '',
    pay: job ? job.pay || '' : '',
    italian: job ? job.italian_level : 'none',
    startDate: job && job.start_date ? job.start_date : '',
    endDate: job ? toDateInput(job.expires_at) : '',
    applyUrl: job ? job.apply_url : '',
    applyEmail: job ? job.apply_email : '',
    area: job && job.area_id ? String(job.area_id) : '',
    onlyArea: job ? !job.show_exact_location : false
  }));
  // The exact spot: only when the job shows it (otherwise the database holds
  // the area's centre, which isn't a pin).
  const [pin, setPin] = useState(() =>
    job && job.show_exact_location && job.latitude != null ? { lat: job.latitude, lon: job.longitude } : null
  );
  const [areas, setAreas] = useState([]);
  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => setAreas([]));
  }, []);
  const [geo, setGeo] = useState({ busy: false, message: '' });
  const areaRow = areas.find((a) => String(a.id) === v.area);
  const areaCentre = areaRow && areaRow.latitude != null ? [areaRow.longitude, areaRow.latitude] : MILAN;

  async function onFindAddress() {
    setGeo({ busy: true, message: '' });
    try {
      const hit = await findAddress(v.location);
      if (hit) {
        setPin({ lat: Math.round(hit.lat * 1e5) / 1e5, lon: Math.round(hit.lon * 1e5) / 1e5 });
        setGeo({ busy: false, message: 'Found it. Check the pin and drag it if needed.' });
      } else {
        setGeo({ busy: false, message: "We couldn't find that address in Milan. Place the pin on the map instead." });
      }
    } catch {
      setGeo({ busy: false, message: "The address search isn't working right now. Place the pin on the map instead." });
    }
  }
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState('');
  const set = (key) => (e) => setV((x) => ({ ...x, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const current = job ? job.status : null;
  const isLive = current === 'published';
  const canSubmit = company.status === 'approved';
  const hours = Number(v.hours);

  function check(submitting) {
    const found = {};
    const title = v.title.trim().replace(/\s+/g, ' ');
    if (!title) found.title = 'Add a job title.';
    else if (title.length > 120) found.title = 'Keep the title under 120 characters.';
    if (!v.jobType) found.jobType = 'Choose the type of job.';
    if (submitting && !v.category) found.category = 'Choose the category.';
    if (v.description.trim().length > 10000) found.description = 'Keep the description under 10,000 characters.';
    if (v.location.trim().length > 200) found.location = 'Keep the location under 200 characters.';
    if (!v.hours) found.hours = 'Add the hours per week.';
    else if (!Number.isInteger(hours) || hours < 1 || hours > 40) found.hours = 'Hours per week must be a whole number from 1 to 40.';
    if (v.pay.trim().length > 200) found.pay = 'Keep the pay under 200 characters.';
    if (v.endDate && v.endDate < today()) found.endDate = 'Choose today or a later date.';
    if (submitting && !v.remote && !v.area) found.area = 'Choose the area (or "Elsewhere in Milan").';
    const url = normalizeUrl(v.applyUrl);
    const email = normalizeEmail(v.applyEmail);
    if (url === null || (url && url.length > 500)) found.applyUrl = 'Enter a web address like www.yourcompany.it/jobs.';
    if (email && (!looksLikeEmail(email) || email.length > 254)) found.applyEmail = "That email address doesn't look right.";
    if (submitting && !url && !email && !found.applyUrl && !found.applyEmail) {
      found.apply = 'Add a link or an email address (or both) so students can apply.';
    }
    const fields = {
      title,
      job_type: v.jobType,
      category: v.category || 'other',
      description: v.description.trim() || null,
      location: v.location.trim() || null,
      remote: Boolean(v.remote),
      hours_per_week: hours,
      pay: v.pay.trim() || null,
      italian_level: v.italian,
      start_date: v.startDate || null,
      area_id: v.area ? Number(v.area) : null,
      show_exact_location: !v.onlyArea,
      // Area only: the database stores the area's centre, whatever is sent.
      latitude: !v.onlyArea && pin ? pin.lat : null,
      longitude: !v.onlyArea && pin ? pin.lon : null
    };
    if (v.endDate) fields.expires_at = endOfDay(v.endDate);
    else if (job) fields.expires_at = new Date(Date.now() + 60 * 86400000).toISOString();
    return { found, fields, contact: { url: url || '', email: email || '' } };
  }

  async function save(status) {
    setSaveError('');
    const submitting = status === 'pending';
    const { found, fields, contact } = check(submitting);
    setErrors(found);
    if (Object.keys(found).length) {
      setSaveError('Check the fields marked above.');
      return;
    }
    setBusy(status);
    try {
      await saveJob({ companyId: company.id, id: job && job.id, fields, contact, status, currentStatus: current });
      navigate('/dashboard', {
        state: { flash: submitting ? `"${fields.title}" is submitted for review.` : `"${fields.title}" is saved as a draft.` }
      });
    } catch (e) {
      setBusy('');
      setSaveError(
        submitting && !canSubmit
          ? 'Jobs can be submitted once your company is approved. Save it as a draft for now.'
          : e && e.savedJobId
            ? "The job is saved, but we couldn't save how to apply. Try again."
            : "We couldn't save the job. Check your connection and try again."
      );
    }
  }

  const err = (k) => errors[k] && <span className="err">{errors[k]}</span>;

  return (
    <div className="job-editor">
      <BackLink />
      <h1 className="page-title">{job ? 'Edit job' : 'New job'}</h1>
      {job && (
        <p className="dash-status-text">
          Status: {JOB_STATUS[current].label}. {JOB_STATUS[current].text}
        </p>
      )}
      {current === 'changes_requested' && job.review_note && (
        <div className="review-note">
          <p className="review-note-label">Note from the reviewer</p>
          <p className="job-text">{job.review_note}</p>
        </div>
      )}
      {isLive && (
        <p className="note editor-warning" role="note">
          This job is live. Saving changes sends it back to review, and students won't see it until it's approved again.
        </p>
      )}

      <form className="auth-form job-form" onSubmit={(e) => { e.preventDefault(); save(canSubmit ? 'pending' : 'draft'); }} noValidate>
        <fieldset className="form-group">
          <legend>The job</legend>
          <label className="field">
            Job title
            <input className="input" type="text" name="title" maxLength={120} value={v.title} onChange={set('title')}
              placeholder="e.g. Weekend barista" aria-invalid={Boolean(errors.title)} required />
            {err('title')}
          </label>
          <label className="field">
            Type of job
            <select className="select" name="job_type" value={v.jobType} onChange={set('jobType')} aria-invalid={Boolean(errors.jobType)} required>
              <option value="">Choose…</option>
              {JOB_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {err('jobType')}
          </label>
          <label className="field">
            Category
            <select className="select" name="category" value={v.category} onChange={set('category')} aria-invalid={Boolean(errors.category)}>
              <option value="">Choose…</option>
              {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {err('category')}
          </label>
          <label className="field">
            <span>Description <span className="field-optional">(optional)</span></span>
            <textarea className="input textarea" name="description" rows={8} maxLength={10000} value={v.description}
              onChange={set('description')} placeholder="What the work is, who you're looking for, anything students should know."
              aria-invalid={Boolean(errors.description)} />
            {err('description')}
          </label>
          <label className="field">
            Italian needed
            <select className="select" name="italian_level" value={v.italian} onChange={set('italian')}>
              {Object.entries(ITALIAN_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </fieldset>

        <fieldset className="form-group">
          <legend>Where and when</legend>
          <label className="field">
            <span>Location <span className="field-optional">(optional)</span></span>
            <input className="input" type="text" name="location" maxLength={200} value={v.location} onChange={set('location')}
              placeholder="e.g. Porta Venezia, Milan" aria-invalid={Boolean(errors.location)} />
            {err('location')}
          </label>
          <label className="check">
            <input type="checkbox" name="remote" checked={v.remote} onChange={set('remote')} /> Can be done remotely
          </label>
          <label className="field">
            <span>Area {v.remote && <span className="field-optional">(optional for remote jobs)</span>}</span>
            <select className="select" name="area_id" value={v.area} onChange={set('area')} aria-invalid={Boolean(errors.area)}>
              <option value="">Choose…</option>
              {areas.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
            </select>
            {err('area')}
          </label>
          {v.area && (
            <label className="check">
              <input type="checkbox" name="only_area" checked={v.onlyArea} onChange={set('onlyArea')} /> Only show the area, not the
              exact spot (e.g. jobs at a private home)
            </label>
          )}
          {v.area && v.onlyArea && (
            <p className="field-hint">Students see only the area. We store its centre, never the address.</p>
          )}
          {v.area && !v.onlyArea && (
            <div className="field">
              <span>Exact spot <span className="field-optional">(optional, shown on the map)</span></span>
              <span className="field-hint">Tap the map to place the pin, then drag it to adjust.</span>
              <div className="location-tools">
                <button type="button" className="btn btn-secondary btn-sm" onClick={onFindAddress}
                  disabled={geo.busy || !v.location.trim()} aria-describedby="find-hint">
                  {geo.busy ? 'Searching…' : 'Find address'}
                </button>
                {pin && <button type="button" className="btn btn-tertiary btn-sm" onClick={() => setPin(null)}>Remove pin</button>}
              </div>
              <span className="field-hint" id="find-hint">"Find address" looks up the location written above, once per press.</span>
              {geo.message && <span className="field-hint geo-message" role="status">{geo.message}</span>}
              <Suspense fallback={<div className="picker-map jobs-map-loading" role="status">Loading the map…</div>}>
                <LocationPicker value={pin} centre={areaCentre} onChange={setPin} />
              </Suspense>
              <span className="osm-credit">Address search by Nominatim, © OpenStreetMap contributors</span>
            </div>
          )}
          <label className="field">
            Hours per week
            <input className="input hours-input" type="number" name="hours_per_week" inputMode="numeric" min={1} max={40} step={1}
              value={v.hours} onChange={set('hours')} aria-invalid={Boolean(errors.hours)} aria-describedby="hours-hint" required />
            {err('hours')}
            {hours > HOURS_HINT_ABOVE && !errors.hours ? (
              <span className="field-hint hours-warning" id="hours-hint">
                Students with a non-EU study permit can usually work up to {HOURS_HINT_ABOVE} hours a week.
              </span>
            ) : (
              <span className="field-hint" id="hours-hint">From 1 to 40.</span>
            )}
          </label>
          <label className="field">
            <span>Pay <span className="field-optional">(optional, but students look for it)</span></span>
            <input className="input" type="text" name="pay" maxLength={200} value={v.pay} onChange={set('pay')}
              placeholder="e.g. €11 an hour" aria-invalid={Boolean(errors.pay)} />
            {err('pay')}
          </label>
          <div className="form-row">
            <label className="field">
              <span>Start date <span className="field-optional">(optional)</span></span>
              <input className="input" type="date" name="start_date" value={v.startDate} onChange={set('startDate')} />
            </label>
            <label className="field">
              <span>Show until <span className="field-optional">(optional)</span></span>
              <input className="input" type="date" name="expires_at" min={today()} value={v.endDate} onChange={set('endDate')}
                aria-invalid={Boolean(errors.endDate)} aria-describedby="end-hint" />
              <span className="field-hint" id="end-hint">Empty: 60 days from today.</span>
              {err('endDate')}
            </label>
          </div>
        </fieldset>

        <fieldset className="form-group">
          <legend>How students apply</legend>
          <p className="field-hint">A link, an email address, or both. Students are sent there when they log in and press "Apply".</p>
          <label className="field">
            Application link
            <input className="input" type="text" name="apply_url" inputMode="url" autoCapitalize="none" spellCheck="false"
              maxLength={500} value={v.applyUrl} onChange={set('applyUrl')} placeholder="www.yourcompany.it/jobs"
              aria-invalid={Boolean(errors.applyUrl || errors.apply)} />
            {err('applyUrl')}
          </label>
          <label className="field">
            Application email
            <input className="input" type="email" name="apply_email" inputMode="email" autoCapitalize="none" spellCheck="false"
              maxLength={254} value={v.applyEmail} onChange={set('applyEmail')} placeholder="jobs@yourcompany.it"
              aria-invalid={Boolean(errors.applyEmail || errors.apply)} />
            {err('applyEmail')}
          </label>
          {errors.apply && <p className="err">{errors.apply}</p>}
        </fieldset>

        {saveError && <p className="err" role="alert">{saveError}</p>}
        {!canSubmit && (
          <p className="field-hint">
            {company.status === 'pending'
              ? 'You can submit jobs for review once your company is approved. For now, save it as a draft.'
              : 'Only approved companies can submit jobs.'}
          </p>
        )}
        <div className="form-buttons">
          <button type="button" className="btn btn-primary" onClick={() => save('pending')} disabled={Boolean(busy) || !canSubmit}>
            {busy === 'pending' ? 'Submitting…' : isLive ? 'Save and submit for review' : 'Submit for review'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => save('draft')} disabled={Boolean(busy)}>
            {busy === 'draft' ? 'Saving…' : isLive ? 'Save as draft (takes it offline)' : 'Save as draft'}
          </button>
        </div>
      </form>
    </div>
  );
}
