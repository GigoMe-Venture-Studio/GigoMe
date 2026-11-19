import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import EmployerGate from '../components/EmployerGate.jsx';
import JobView from '../components/JobView.jsx';
import { supabase } from '../lib/supabase.js';
import { normalizeEmail } from '../lib/auth.js';
import { isPlainEmail } from '../lib/links.js';
import { dailyLimitMessage } from '../lib/limits.js';
import { useCompanyAccount } from '../lib/useCompanyAccount.js';
import { CATEGORIES, ITALIAN_LABEL, JOB_TYPE_LABEL, JOB_TYPES, LANGUAGES, PAY_UNIT_LABEL, PAY_UNITS, SCHEDULE_HOURS, SCHEDULES, monthlyHours } from '../lib/jobs.js';
import { HOURS_HINT_ABOVE, JOB_STATUS, fetchMyJob, normalizeUrl, saveJob } from '../lib/employer.js';
import { fetchAreas } from '../lib/areas.js';
import { findAddress } from '../lib/geocode.js';
import { metresBetween } from '../lib/geo.js';
import { locale } from '../lib/i18n.js';
import { useT } from '../lib/useLang.js';

// The pin map is only downloaded when it is shown.
const LocationPicker = lazy(() => import('../components/LocationPicker.jsx'));
const MILAN = [9.19, 45.4642];

// The metro stations, for the preview's "M1 Porta Venezia · 4 min walk" badge
// (the database works it out the same way once the job is saved). Read once.
let stations = null;
async function nearestStation(lat, lon) {
  try {
    if (!stations) {
      const res = await fetch('/metro/milan-metro.geojson');
      const geo = await res.json();
      stations = geo.features.filter((f) => f.properties.kind === 'station');
    }
  } catch {
    return null;
  }
  let best = null;
  for (const f of stations) {
    const m = metresBetween([lon, lat], f.geometry.coordinates);
    if (!best || m < best.m) best = { m, f };
  }
  if (!best) return null;
  const [longitude, latitude] = best.f.geometry.coordinates;
  return { m: Math.round(best.m), station: { name: best.f.properties.name, lines: best.f.properties.lines.split(' '), latitude, longitude } };
}

// /dashboard/jobs/new and /dashboard/jobs/:id/edit
// The structure suggested for descriptions (editor.descriptionPlaceholder);
// job pages show the headings and lists it makes (src/lib/description.js).

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
  const t = useT();
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

  if (state.status === 'loading') return <p className="muted">{t('editor.loadingJob')}</p>;
  if (state.status === 'error') return <p className="err" role="alert">{t('editor.loadError')}</p>;
  if (state.status === 'missing') {
    return (
      <div className="empty-state page-empty">
        <BackLink />
        <h1 className="page-title">{t('editor.notFoundTitle')}</h1>
        <p className="muted">{t('editor.notFoundText')}</p>
      </div>
    );
  }
  if (state.job.status === 'rejected') {
    return (
      <div className="empty-state page-empty">
        <BackLink />
        <h1 className="page-title">{state.job.title}</h1>
        <p>{t('editor.rejectedText')}</p>
        {state.job.review_note && <p className="muted job-text">{t('editor.reviewerNote', { note: state.job.review_note })}</p>}
      </div>
    );
  }
  return <JobForm company={company} job={state.job} />;
}

function BackLink() {
  const t = useT();
  return (
    <Link className="back" to="/dashboard">
      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
      {t('editor.back')}
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
// The last day an owner can choose (the database allows 60 days from now).
const inDays = (n) => toDateInput(new Date(Date.now() + n * 86400000).toISOString());

function JobForm({ company, job }) {
  const t = useT();
  const navigate = useNavigate();
  const [v, setV] = useState(() => ({
    title: job ? job.title : '',
    // A type or pay unit that isn't offered any more (an internship, unpaid)
    // starts empty, so the owner chooses again.
    jobType: job && JOB_TYPE_LABEL[job.job_type] ? job.job_type : '',
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
    onlyArea: job ? !job.show_exact_location : false,
    payUnit: job && PAY_UNIT_LABEL[job.pay_unit] ? job.pay_unit : '',
    payMin: job && job.pay_min != null ? String(Number(job.pay_min)) : '',
    payMax: job && job.pay_max != null ? String(Number(job.pay_max)) : '',
    schedule: job ? job.schedule || [] : [],
    languages: job ? job.languages || [] : []
  }));
  const toggle = (key, value) => (e) =>
    setV((x) => ({ ...x, [key]: e.target.checked ? [...new Set([...x[key], value])] : x[key].filter((y) => y !== value) }));
  // The exact spot: only when the job shows it (otherwise the database holds
  // the area's centre, which isn't a pin).
  const [pin, setPin] = useState(() =>
    job && job.show_exact_location && job.latitude != null ? { lat: job.latitude, lon: job.longitude } : null
  );
  const [areas, setAreas] = useState([]);
  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => setAreas([]));
  }, []);
  // message: a translation key, so it follows the language switch.
  const [geo, setGeo] = useState({ busy: false, message: '' });
  const areaRow = areas.find((a) => String(a.id) === v.area);
  const areaCentre = areaRow && areaRow.latitude != null ? [areaRow.longitude, areaRow.latitude] : MILAN;

  async function onFindAddress() {
    setGeo({ busy: true, message: '' });
    try {
      const hit = await findAddress(v.location);
      if (hit) {
        setPin({ lat: Math.round(hit.lat * 1e5) / 1e5, lon: Math.round(hit.lon * 1e5) / 1e5 });
        setGeo({ busy: false, message: 'editor.geoFound' });
      } else {
        setGeo({ busy: false, message: 'editor.geoNotFound' });
      }
    } catch {
      setGeo({ busy: false, message: 'editor.geoError' });
    }
  }
  // The date the job had when the form opened: sent again only if changed.
  const loadedEndDate = job ? toDateInput(job.expires_at) : '';
  // Field errors are translation keys (rendered with t() by err() below).
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState('');
  const set = (key) => (e) => setV((x) => ({ ...x, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  // After a save with errors: bring the first marked field into view and
  // focus it (the first box of a group of checkboxes), instead of leaving the
  // employer at the bottom with "Check the fields marked above".
  const formRef = useRef(null);
  const [focusTry, setFocusTry] = useState(0);
  useEffect(() => {
    if (!focusTry || !formRef.current) return;
    const bad = formRef.current.querySelector('[aria-invalid="true"]');
    if (!bad) return;
    const target = bad.matches('fieldset') ? bad.querySelector('input, select, textarea') || bad : bad;
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    target.focus({ preventScroll: true });
  }, [focusTry]);

  const current = job ? job.status : null;
  const isLive = current === 'published';
  const canSubmit = company.status === 'approved';
  const hours = Number(v.hours);

  function check(submitting) {
    const found = {};
    const title = v.title.trim().replace(/\s+/g, ' ');
    if (!title) found.title = 'editor.errTitle';
    else if (title.length > 120) found.title = 'editor.errTitleLong';
    if (!v.jobType) found.jobType = 'editor.errJobType';
    if (submitting && !v.category) found.category = 'editor.errCategory';
    if (v.description.trim().length > 10000) found.description = 'editor.errDescription';
    if (v.location.trim().length > 200) found.location = 'editor.errLocation';
    if (!v.hours) found.hours = 'editor.errHours';
    else if (!Number.isInteger(hours) || hours < 1 || hours > 40) found.hours = 'editor.errHoursRange';
    if (v.pay.trim().length > 200) found.pay = 'editor.errPayNote';
    // Structured pay: a unit and an amount.
    const paid = Boolean(v.payUnit);
    const payMin = amount(v.payMin), payMax = amount(v.payMax);
    if (submitting && !v.payUnit) found.payUnit = 'editor.errPayUnit';
    if (paid && v.payMin.trim() === '' && submitting) found.payMin = 'editor.errPayMin';
    else if (paid && v.payMin.trim() !== '' && !(payMin > 0 && payMin <= 100000)) found.payMin = 'editor.errPayMinFormat';
    if (paid && v.payMax.trim() !== '' && !(payMax > 0 && payMax <= 100000)) found.payMax = 'editor.errPayMaxFormat';
    else if (paid && payMax != null && payMin != null && payMax < payMin) found.payMax = 'editor.errPayMaxLow';
    if (v.endDate && v.endDate < today()) found.endDate = 'editor.errEndPast';
    else if (v.endDate && v.endDate > inDays(60) && v.endDate !== loadedEndDate) found.endDate = 'editor.errEndFar';
    if (submitting && !v.remote && !v.area) found.area = 'editor.errArea';
    if (submitting && !v.schedule.length) found.schedule = 'editor.errSchedule';
    const url = normalizeUrl(v.applyUrl);
    const email = normalizeEmail(v.applyEmail);
    if (url === null || (url && url.length > 500)) found.applyUrl = 'editor.errApplyUrl';
    if (email && (!isPlainEmail(email) || email.length > 254)) found.applyEmail = 'editor.errApplyEmail';
    if (submitting && !url && !email && !found.applyUrl && !found.applyEmail) {
      found.apply = 'editor.errApply';
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
      // A unit only with its amount (a half-filled draft keeps neither).
      pay_unit: paid && payMin > 0 ? v.payUnit : null,
      pay_min: paid && payMin > 0 ? payMin : null,
      pay_max: paid && payMin > 0 && payMax > 0 && payMax !== payMin ? payMax : null,
      italian_level: v.italian,
      start_date: v.startDate || null,
      area_id: v.area ? Number(v.area) : null,
      show_exact_location: !v.onlyArea,
      // Area only: the database stores the area's centre, whatever is sent.
      latitude: !v.onlyArea && pin ? pin.lat : null,
      longitude: !v.onlyArea && pin ? pin.lon : null,
      schedule: SCHEDULES.map(([x]) => x).filter((x) => v.schedule.includes(x)),
      languages: LANGUAGES.map(([x]) => x).filter((x) => v.languages.includes(x))
    };
    // An unchanged date isn't sent again, so the saved time stays.
    if (v.endDate) {
      if (v.endDate !== loadedEndDate) fields.expires_at = endOfDay(v.endDate);
    } else if (job) fields.expires_at = new Date(Date.now() + 60 * 86400000).toISOString();
    return { found, fields, contact: { url: url || '', email: email || '' } };
  }

  async function save(status) {
    setSaveError('');
    const submitting = status === 'pending';
    const { found, fields, contact } = check(submitting);
    setErrors(found);
    if (Object.keys(found).length) {
      setSaveError(t('editor.checkFields'));
      setFocusTry((n) => n + 1);
      return;
    }
    setBusy(status);
    try {
      await saveJob({ companyId: company.id, id: job && job.id, fields, contact, status, currentStatus: current });
      navigate('/dashboard', {
        state: { flash: t(submitting ? 'editor.flashSubmitted' : 'editor.flashDraft', { title: fields.title }) }
      });
    } catch (e) {
      setBusy('');
      setSaveError(
        dailyLimitMessage(e) || (e && /at most 60 days/.test(e.message || '') && t('editor.err60Days')) ||
        (submitting && !canSubmit
          ? t('editor.errNotApproved')
          : e && e.savedJobId
            ? t('editor.errContact')
            : t('editor.errSave'))
      );
    }
  }

  const err = (k) => errors[k] && <span className="err">{t(errors[k])}</span>;

  // "Preview": the job page exactly as students will see it once published,
  // built from the form as it is now. Nothing is saved.
  const [preview, setPreview] = useState(null);
  async function openPreview() {
    const { fields } = check(false);
    const exactPoint = fields.show_exact_location && fields.latitude != null;
    // Area only: the database stores the area's centre, so the preview does too.
    const point = exactPoint
      ? [fields.longitude, fields.latitude]
      : areaRow && areaRow.latitude != null && fields.area_id
        ? [areaRow.longitude, areaRow.latitude]
        : null;
    const near = exactPoint ? await nearestStation(fields.latitude, fields.longitude) : null;
    const now = new Date().toISOString();
    setPreview({
      ...fields,
      id: job ? job.id : 'preview',
      title: fields.title,
      hours_per_week: Number.isInteger(hours) ? hours : '?',
      created_at: now,
      published_at: now,
      areas: areaRow ? { name: areaRow.name } : null,
      latitude: point ? point[1] : null,
      longitude: point ? point[0] : null,
      metro_stations: near ? near.station : null,
      nearest_station_m: near ? near.m : null,
      companies: company
    });
    window.scrollTo(0, 0);
  }
  function closePreview() {
    setPreview(null);
    window.scrollTo(0, 0);
  }

  if (preview) {
    return (
      <div className="editor-preview">
        <div className="preview-banner" role="note">
          <p>{t('editor.previewBanner', { b: (s) => <strong>{s}</strong> })}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={closePreview}>{t('editor.backToEditing')}</button>
        </div>
        <JobView
          preview
          job={preview}
          apply={
            <>
              <button type="button" className="btn btn-primary" disabled>{t('editor.apply')}</button>
              <p className="apply-note">{t('editor.applyNote')}</p>
            </>
          }
        />
        <p className="preview-back">
          <button type="button" className="btn btn-secondary" onClick={closePreview}>{t('editor.backToEditing')}</button>
        </p>
      </div>
    );
  }

  return (
    <div className="job-editor">
      <BackLink />
      <h1 className="page-title">{job ? t('editor.editTitle') : t('editor.newTitle')}</h1>
      {job && (
        <p className="dash-status-text">
          {t('editor.status', { label: JOB_STATUS[current].label, text: JOB_STATUS[current].text })}
        </p>
      )}
      {current === 'changes_requested' && job.review_note && (
        <div className="review-note">
          <p className="review-note-label">{t('editor.reviewerNoteLabel')}</p>
          <p className="job-text">{job.review_note}</p>
        </div>
      )}
      {isLive && (
        <p className="note editor-warning" role="note">
          {t('editor.liveWarning')}
        </p>
      )}

      <form ref={formRef} className="auth-form job-form" onSubmit={(e) => { e.preventDefault(); save(canSubmit ? 'pending' : 'draft'); }} noValidate>
        <fieldset className="form-group">
          <legend>{t('editor.groupJob')}</legend>
          <label className="field">
            {t('editor.title')}
            <input className="input" type="text" name="title" maxLength={120} value={v.title} onChange={set('title')}
              placeholder={t('editor.titlePlaceholder')} aria-invalid={Boolean(errors.title)} required />
            {err('title')}
          </label>
          <label className="field">
            {t('editor.jobType')}
            <select className="select" name="job_type" value={v.jobType} onChange={set('jobType')} aria-invalid={Boolean(errors.jobType)} required>
              <option value="">{t('editor.choose')}</option>
              {JOB_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {err('jobType')}
          </label>
          <label className="field">
            {t('editor.category')}
            <select className="select" name="category" value={v.category} onChange={set('category')} aria-invalid={Boolean(errors.category)}>
              <option value="">{t('editor.choose')}</option>
              {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {err('category')}
          </label>
          <label className="field">
            <span>{t('editor.description')} <span className="field-optional">{t('editor.optional')}</span></span>
            <span className="field-hint" id="description-hint">
              {t('editor.descriptionHint', { b: (s) => <strong>{s}</strong> })}
            </span>
            <textarea className="input textarea" name="description" rows={10} maxLength={10000} value={v.description}
              onChange={set('description')} placeholder={t('editor.descriptionPlaceholder')}
              aria-invalid={Boolean(errors.description)} aria-describedby="description-hint" />
            {err('description')}
          </label>
          <label className="field">
            {t('editor.italian')}
            <select className="select" name="italian_level" value={v.italian} onChange={set('italian')}>
              {Object.entries(ITALIAN_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <fieldset className="check-group">
            <legend>{t('editor.languages')} <span className="field-optional">{t('editor.optional')}</span></legend>
            <div className="check-grid">
              {LANGUAGES.map(([value, label]) => (
                <label key={value} className="check">
                  <input type="checkbox" name="languages" value={value} checked={v.languages.includes(value)} onChange={toggle('languages', value)} /> {label}
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>

        <fieldset className="form-group">
          <legend>{t('editor.groupWhere')}</legend>
          <label className="field">
            <span>{t('editor.location')} <span className="field-optional">{t('editor.optional')}</span></span>
            <input className="input" type="text" name="location" maxLength={200} value={v.location} onChange={set('location')}
              placeholder={t('editor.locationPlaceholder')} aria-invalid={Boolean(errors.location)} />
            {err('location')}
          </label>
          <label className="check">
            <input type="checkbox" name="remote" checked={v.remote} onChange={set('remote')} /> {t('editor.remote')}
          </label>
          <label className="field">
            <span>{t('editor.area')} {v.remote && <span className="field-optional">{t('editor.areaOptionalRemote')}</span>}</span>
            <select className="select" name="area_id" value={v.area} onChange={set('area')} aria-invalid={Boolean(errors.area)}>
              <option value="">{t('editor.choose')}</option>
              {areas.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
            </select>
            {err('area')}
          </label>
          {v.area && (
            <label className="check">
              <input type="checkbox" name="only_area" checked={v.onlyArea} onChange={set('onlyArea')} /> {t('editor.onlyArea')}
            </label>
          )}
          {v.area && v.onlyArea && (
            <p className="field-hint">{t('editor.onlyAreaHint')}</p>
          )}
          {v.area && !v.onlyArea && (
            <div className="field">
              <span>{t('editor.exactSpot')} <span className="field-optional">{t('editor.exactSpotOptional')}</span></span>
              <span className="field-hint">{t('editor.pinHint')}</span>
              <div className="location-tools">
                <button type="button" className="btn btn-secondary btn-sm" onClick={onFindAddress}
                  disabled={geo.busy || !v.location.trim()} aria-describedby="find-hint">
                  {geo.busy ? t('editor.searching') : t('editor.findAddress')}
                </button>
                {pin && <button type="button" className="btn btn-tertiary btn-sm" onClick={() => setPin(null)}>{t('editor.removePin')}</button>}
              </div>
              <span className="field-hint" id="find-hint">{t('editor.findHint')}</span>
              {geo.message && <span className="field-hint geo-message" role="status">{t(geo.message)}</span>}
              <Suspense fallback={<div className="picker-map jobs-map-loading" role="status">{t('editor.loadingMap')}</div>}>
                <LocationPicker value={pin} centre={areaCentre} onChange={setPin} />
              </Suspense>
              <span className="osm-credit">{t('editor.osmCredit')}</span>
            </div>
          )}
          <fieldset className="check-group" aria-invalid={Boolean(errors.schedule)}>
            <legend>{t('editor.when')} <span className="field-optional">{t('editor.whenRequired')}</span></legend>
            <div className="check-grid check-grid-when">
              {SCHEDULES.map(([value, label]) => (
                <label key={value} className="check check-when">
                  <input type="checkbox" name="schedule" value={value} checked={v.schedule.includes(value)} onChange={toggle('schedule', value)} />
                  <span>{label}<span className="check-when-def">{SCHEDULE_HOURS[value]}</span></span>
                </label>
              ))}
            </div>
            {err('schedule')}
          </fieldset>
          <label className="field">
            {t('editor.hours')}
            <input className="input hours-input" type="number" name="hours_per_week" inputMode="numeric" min={1} max={40} step={1}
              value={v.hours} onChange={set('hours')} aria-invalid={Boolean(errors.hours)} aria-describedby="hours-hint" required />
            {err('hours')}
            {hours > HOURS_HINT_ABOVE && !errors.hours ? (
              <span className="field-hint hours-warning" id="hours-hint">
                {t('editor.hoursWarning', { hours: HOURS_HINT_ABOVE })}
              </span>
            ) : (
              <span className="field-hint" id="hours-hint">{t('editor.hoursHint')}</span>
            )}
          </label>
          <fieldset className="check-group pay-group">
            <legend>{t('editor.pay')} <span className="field-optional">{t('editor.payRequired')}</span></legend>
            <label className="field">
              {t('editor.payUnit')}
              <select className="select" name="pay_unit" value={v.payUnit} onChange={set('payUnit')} aria-invalid={Boolean(errors.payUnit)}>
                <option value="">{t('editor.choose')}</option>
                {PAY_UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {err('payUnit')}
            </label>
            {v.payUnit && (
              <div className="form-row pay-amounts">
                <label className="field">
                  <span>{v.payUnit === 'hour' ? t('editor.perHour') : v.payUnit === 'month' ? t('editor.perMonth') : t('editor.perProject')}</span>
                  <input className="input" type="text" inputMode="decimal" name="pay_min" value={v.payMin} onChange={set('payMin')}
                    placeholder={t('editor.payMinPlaceholder')} aria-invalid={Boolean(errors.payMin)} />
                  {err('payMin')}
                </label>
                <label className="field">
                  <span>{t('editor.payMax')} <span className="field-optional">{t('editor.payMaxOptional')}</span></span>
                  <input className="input" type="text" inputMode="decimal" name="pay_max" value={v.payMax} onChange={set('payMax')}
                    placeholder={t('editor.payMaxPlaceholder')} aria-invalid={Boolean(errors.payMax)} />
                  {err('payMax')}
                </label>
              </div>
            )}
            {v.payUnit === 'month' && <HourlyEquivalent min={amount(v.payMin)} max={amount(v.payMax)} hours={hours} />}
            <label className="field">
              <span>{t('editor.payNote')} <span className="field-optional">{t('editor.optional')}</span></span>
              <input className="input" type="text" name="pay" maxLength={200} value={v.pay} onChange={set('pay')}
                placeholder={t('editor.payNotePlaceholder')} aria-invalid={Boolean(errors.pay)} />
              {err('pay')}
            </label>
          </fieldset>
          <div className="form-row">
            <label className="field">
              <span>{t('editor.startDate')} <span className="field-optional">{t('editor.optional')}</span></span>
              <input className="input" type="date" name="start_date" value={v.startDate} onChange={set('startDate')} />
            </label>
            <label className="field">
              <span>{t('editor.showUntil')} <span className="field-optional">{t('editor.optional')}</span></span>
              <input className="input" type="date" name="expires_at" min={today()} max={loadedEndDate > inDays(60) ? loadedEndDate : inDays(60)} value={v.endDate} onChange={set('endDate')}
                aria-invalid={Boolean(errors.endDate)} aria-describedby="end-hint" />
              <span className="field-hint" id="end-hint">{t('editor.endHint')}</span>
              {err('endDate')}
            </label>
          </div>
        </fieldset>

        <fieldset className="form-group">
          <legend>{t('editor.groupApply')}</legend>
          <p className="field-hint">{t('editor.applyHint')}</p>
          <label className="field">
            {t('editor.applyUrl')}
            <input className="input" type="text" name="apply_url" inputMode="url" autoCapitalize="none" spellCheck="false" /* i18n-ignore: attribute values, not text */
              maxLength={500} value={v.applyUrl} onChange={set('applyUrl')} placeholder={t('editor.applyUrlPlaceholder')}
              aria-invalid={Boolean(errors.applyUrl || errors.apply)} />
            {err('applyUrl')}
          </label>
          <label className="field">
            {t('editor.applyEmail')}
            <input className="input" type="email" name="apply_email" inputMode="email" autoCapitalize="none" spellCheck="false" /* i18n-ignore: attribute values, not text */
              maxLength={254} value={v.applyEmail} onChange={set('applyEmail')} placeholder={t('editor.applyEmailPlaceholder')}
              aria-invalid={Boolean(errors.applyEmail || errors.apply)} />
            {err('applyEmail')}
          </label>
          {errors.apply && <p className="err">{t(errors.apply)}</p>}
        </fieldset>

        {saveError && <p className="err" role="alert">{saveError}</p>}
        {!canSubmit && (
          <p className="field-hint">
            {company.status === 'pending'
              ? t('editor.pendingCompany')
              : t('editor.notApproved')}
          </p>
        )}
        <div className="form-buttons">
          <button type="button" className="btn btn-primary" onClick={() => save('pending')} disabled={Boolean(busy) || !canSubmit}>
            {busy === 'pending' ? t('editor.submitting') : isLive ? t('editor.saveAndSubmit') : t('editor.submit')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => save('draft')} disabled={Boolean(busy)}>
            {busy === 'draft' ? t('editor.saving') : isLive ? t('editor.saveDraftLive') : t('editor.saveDraft')}
          </button>
          <button type="button" className="btn btn-tertiary" onClick={openPreview} disabled={Boolean(busy)}>{t('editor.preview')}</button>
        </div>
      </form>
    </div>
  );
}

// "11", "11.50" or "11,50" as a number of euros; null when empty or not a number.
function amount(text) {
  const t = String(text || '').trim().replace(/^€\s*/, '').replace(',', '.');
  if (!t || !/^\d+(\.\d{1,2})?$/.test(t)) return t ? NaN : null;
  return Number(t);
}

// Monthly pay: the hourly equivalent, worked out the way the database does
// (monthly ÷ (hours per week × 52 ÷ 12)).
function HourlyEquivalent({ min, max, hours }) {
  const t = useT();
  if (!(min > 0) || !Number.isInteger(hours) || hours < 1 || hours > 40) {
    return <p className="field-hint pay-hourly">{t('editor.hourlyNeedData')}</p>;
  }
  // Two decimals, no thousands separator: "12.50" / "12,50".
  const per = (x) =>
    (Math.round((x / monthlyHours(hours)) * 100) / 100).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
  return (
    <p className="field-hint pay-hourly" role="status">
      {t('editor.hourlyEquivalent', { range: max > min ? `${per(min)}–${per(max)}` : per(min), hours, min: per(min) })}
    </p>
  );
}
