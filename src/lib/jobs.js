// The job board: reading live jobs and revealing how to apply.
import { safeHttpUrl } from './links.js';
import { supabase } from './supabase.js';

// Values allowed by the database (jobs.job_type, jobs.italian_level).
export const JOB_TYPES = [
  ['gig', 'Gig'],
  ['part_time', 'Part-time'],
  ['internship', 'Internship'],
  ['other', 'Other']
];
export const JOB_TYPE_LABEL = Object.fromEntries(JOB_TYPES);
export const ITALIAN_LABEL = { none: 'No Italian needed', basic: 'Basic Italian', fluent: 'Fluent Italian' };
export const MAX_HOURS_OPTIONS = [10, 15, 20, 25, 30];
// Values allowed by jobs.category.
export const CATEGORIES = [
  ['hospitality', 'Hospitality'],
  ['retail', 'Retail'],
  ['tutoring_education', 'Tutoring & education'],
  ['office_admin', 'Office & admin'],
  ['marketing_social', 'Marketing & social media'],
  ['events', 'Events'],
  ['tech', 'Tech'],
  ['other', 'Other']
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);
// Values allowed by jobs.schedule (when the job happens). A "flexible" job
// matches any "When" filter.
export const SCHEDULES = [
  ['weekday_mornings', 'Weekday mornings'],
  ['weekday_afternoons', 'Weekday afternoons'],
  ['weekday_evenings', 'Weekday evenings'],
  ['weekends', 'Weekends'],
  ['flexible', 'Flexible']
];
export const SCHEDULE_LABEL = Object.fromEntries(SCHEDULES);
// Values allowed by jobs.languages (languages used at work; optional).
export const LANGUAGES = [
  ['en', 'English'],
  ['it', 'Italian'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['zh', 'Chinese'],
  ['ar', 'Arabic'],
  ['other', 'Other']
];
export const LANGUAGE_LABEL = Object.fromEntries(LANGUAGES);
// Values allowed by jobs.pay_unit. Unpaid only as a curricular internship.
export const PAY_UNITS = [
  ['hour', 'Per hour'],
  ['month', 'Per month'],
  ['project', 'Per project'],
  ['unpaid_curricular', 'Curricular internship (university credits)']
];
export const MAX_MIN_PAY = 30; // the "Minimum pay" slider goes from €0 to €30 an hour
// In the order of the list, so labels always read the same way.
export const scheduleLabels = (job) => SCHEDULES.filter(([v]) => (job.schedule || []).includes(v)).map(([, l]) => l);
export const languageLabels = (job) => LANGUAGES.filter(([v]) => (job.languages || []).includes(v)).map(([, l]) => l);

// Columns every job list and page reads (jobs have column-level grants: list
// them, never select *).
const LIST_COLUMNS =
  'id, title, job_type, location, remote, hours_per_week, pay, pay_unit, pay_min, pay_max, pay_hourly, italian_level, created_at, ' +
  'category, published_at, schedule, languages, ' +
  'area_id, latitude, longitude, show_exact_location, nearest_station_m, areas(name), metro_stations(name, lines)';

// A search keyword, reduced to letters, numbers, spaces, hyphens and
// apostrophes. Everything else is dropped, so the keyword can be placed
// safely inside PostgREST's or() filter below and can't change the query.
export function cleanKeyword(raw) {
  return String(raw || '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

// A comma-separated list in the URL, keeping only allowed values, in the
// list's order.
function readList(value, allowed) {
  const asked = String(value || '').split(',');
  return allowed.filter(([v]) => asked.includes(v)).map(([v]) => v);
}

// Filters live in the URL (?q=barista&area=3&type=part_time&remote=yes&italian=none&hours=20
// &when=weekends,weekday_evenings&lang=en,es)
// so a filtered list can be shared. Unknown values are ignored. area is an
// areas.id (see src/lib/areas.js).
export function readFilters(params) {
  const area = Number(params.get('area'));
  const category = params.get('category');
  const type = params.get('type');
  const remote = params.get('remote');
  const italian = params.get('italian');
  const hours = Number(params.get('hours'));
  const minpay = Number(params.get('minpay'));
  return {
    q: cleanKeyword(params.get('q')),
    area: Number.isInteger(area) && area >= 1 && area <= 32767 ? String(area) : '',
    category: CATEGORY_LABEL[category] ? category : '',
    type: JOB_TYPE_LABEL[type] ? type : '',
    remote: remote === 'yes' || remote === 'no' ? remote : '',
    italian: italian === 'none' || italian === 'basic' ? italian : '',
    hours: Number.isInteger(hours) && hours >= 1 && hours <= 40 ? String(hours) : '',
    when: readList(params.get('when'), SCHEDULES),
    lang: readList(params.get('lang'), LANGUAGES),
    minpay: Number.isInteger(minpay) && minpay >= 1 && minpay <= MAX_MIN_PAY ? String(minpay) : '',
    // With a minimum pay, jobs without an hourly equivalent (paid per
    // project, unpaid, pay not specified) are hidden unless asked for.
    // ("projects=yes" is the older name, from saved searches.)
    nohourly: (params.get('nohourly') === 'yes' || params.get('projects') === 'yes') && Number.isInteger(minpay) && minpay >= 1 ? 'yes' : '',
    // Not a filter: the order of the list.
    sort: params.get('sort') === 'pay' ? 'pay' : ''
  };
}
export function filtersToParams(filters) {
  const out = {};
  if (filters.q) out.q = filters.q;
  if (filters.area) out.area = filters.area;
  if (filters.category) out.category = filters.category;
  if (filters.type) out.type = filters.type;
  if (filters.remote) out.remote = filters.remote;
  if (filters.italian) out.italian = filters.italian;
  if (filters.hours) out.hours = filters.hours;
  // In the list's order, so the same choice always gives the same link.
  if (filters.when && filters.when.length) out.when = SCHEDULES.map(([v]) => v).filter((v) => filters.when.includes(v)).join(',');
  if (filters.lang && filters.lang.length) out.lang = LANGUAGES.map(([v]) => v).filter((v) => filters.lang.includes(v)).join(',');
  if (filters.minpay) out.minpay = filters.minpay;
  if (filters.minpay && filters.nohourly) out.nohourly = 'yes';
  if (filters.sort) out.sort = filters.sort;
  return out;
}
export function hasFilters(filters) {
  return Boolean(
    filters.q || filters.area || filters.category || filters.type || filters.remote || filters.italian || filters.hours ||
      (filters.when && filters.when.length) || (filters.lang && filters.lang.length) || filters.minpay
  );
}

// The database already limits visitors and students to live jobs, but a
// company owner also sees its own drafts and admins see everything, so the
// public list asks for live jobs explicitly: published, not expired, from an
// approved company.
function liveJobs(columns) {
  return supabase
    .from('jobs')
    .select(columns)
    .eq('status', 'published')
    .gt('expires_at', new Date().toISOString())
    .eq('companies.status', 'approved');
}

export async function fetchJobs(filters, { limit = 200 } = {}) {
  let query = filtered(liveJobs(LIST_COLUMNS + ', companies!inner(name, status)'), filters);
  // Highest pay: by the hourly equivalent; jobs without one (per project,
  // unpaid, no structured pay) after the rest.
  if (filters.sort === 'pay') query = query.order('pay_hourly', { ascending: false, nullsFirst: false });
  // Newest first by when each job went live (published_at, set by the
  // database on first publication), not when its draft was started. A job
  // without one comes after, by when it was written (see postedAt()).
  const { data, error } = await query
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// What a minimum pay hides whatever the amount: live jobs matching the other
// filters that have no hourly equivalent. { total, project, unpaid,
// unspecified } (only each job's pay unit is read).
export async function fetchHiddenByPay(filters) {
  const { data, error } = await filtered(liveJobs('pay_unit, companies!inner(status)'), { ...filters, minpay: '', nohourly: '' })
    .is('pay_hourly', null)
    .limit(1000);
  if (error) throw error;
  const rows = data || [];
  return {
    total: rows.length,
    project: rows.filter((r) => r.pay_unit === 'project').length,
    unpaid: rows.filter((r) => r.pay_unit === 'unpaid_curricular').length,
    unspecified: rows.filter((r) => !r.pay_unit).length
  };
}

// "paid per project, unpaid or pay not specified": the kinds that are there.
export function hiddenKinds(h) {
  const kinds = [h.project && 'paid per project', h.unpaid && 'unpaid', h.unspecified && 'pay not specified'].filter(Boolean);
  return kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} or ${kinds[kinds.length - 1]}` : kinds[0] || '';
}

function filtered(query, filters) {
  // Keyword: matches the title or the description, ignoring case.
  const q = cleanKeyword(filters.q);
  if (q) query = query.or(`title.ilike."*${q}*",description.ilike."*${q}*"`);
  if (filters.area) query = query.eq('area_id', Number(filters.area));
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.companyId) query = query.eq('company_id', filters.companyId);
  if (filters.companyIds) query = query.in('company_id', filters.companyIds);
  // When: any chosen time, and flexible jobs always fit.
  if (filters.when && filters.when.length) query = query.overlaps('schedule', [...new Set([...filters.when, 'flexible'])]);
  if (filters.lang && filters.lang.length) query = query.overlaps('languages', filters.lang);
  if (filters.ids) query = query.in('id', filters.ids);
  if (filters.type) query = query.eq('job_type', filters.type);
  if (filters.remote === 'yes') query = query.eq('remote', true);
  if (filters.remote === 'no') query = query.eq('remote', false);
  if (filters.italian === 'none') query = query.eq('italian_level', 'none');
  if (filters.italian === 'basic') query = query.in('italian_level', ['none', 'basic']);
  if (filters.hours) query = query.lte('hours_per_week', Number(filters.hours));
  // Minimum pay (€ an hour): the hourly equivalent, which only hourly and
  // monthly pay have; jobs without one only when asked for.
  if (filters.minpay) {
    query = filters.nohourly
      ? query.or(`pay_hourly.gte.${Number(filters.minpay)},pay_hourly.is.null`)
      : query.gte('pay_hourly', Number(filters.minpay));
  }
  return query;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One live job, or null when it doesn't exist or isn't live.
export async function fetchJob(id) {
  if (!UUID.test(id || '')) return null;
  // The job page also needs the station's position, for its small map.
  const columns = LIST_COLUMNS.replace('metro_stations(name, lines)', 'metro_stations(name, lines, latitude, longitude)');
  const { data, error } = await liveJobs(columns + ', description, start_date, expires_at, companies!inner(id, name, website, description, status)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Students only. Returns { url, email } (either may be null), or { error }.
// The database records an apply click every time this is called.
export async function revealContact(jobId) {
  const { data, error } = await supabase.rpc('reveal_job_contact', { p_job_id: jobId });
  if (error) {
    if (error.code === '42501') return { error: 'Only student accounts can see how to apply.' };
    if (error.code === 'P0002') return { error: "This job isn't available any more." };
    return { error: "We couldn't load how to apply. Check your connection and try again." };
  }
  const row = (data || [])[0] || {};
  // Only an http(s) link is ever opened (the database refuses anything else
  // too); the email is shown as text and linked only when it's plain.
  return { url: safeHttpUrl(row.apply_url), email: row.apply_email || null };
}

// The place as written by the employer, or else the area's name.
export function placeLabel(job) {
  const place = job.location || (job.areas && job.areas.name) || '';
  if (job.remote) return place ? `Remote or ${place}` : 'Remote';
  return place || 'Location not listed';
}
// "M1 Porta Venezia · 4 min walk" for an exact location within about 1 km of
// a station (walking about 80 m a minute), otherwise null.
export function metroLabel(job) {
  const s = job.metro_stations;
  const m = job.nearest_station_m;
  if (!job.show_exact_location || !s || m == null || m > 1000) return null;
  return `${s.lines.join(' ')} ${s.name} · ${Math.max(1, Math.round(m / 80))} min walk`;
}

// Published in the last 3 days.
export function isNew(job) {
  const t = job.published_at ? new Date(job.published_at).getTime() : 0;
  return t > 0 && Date.now() - t < 3 * 86400000;
}

export function hoursLabel(job) {
  return `${job.hours_per_week} h/week`;
}
// "€11/h" for a map marker: the first amount in the pay text (with its "/h",
// "/day", "per month"...) when there is one, else the text, shortened.
export function shortPay(pay) {
  const s = String(pay || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const m = s.match(/(€\s?\d[\d.,]*(?:\s?(?:\/|per |a |an |al )\s?(?:h|hr|hour|ora|day|giorno|week|month|mese|shift|turno))?)/i);
  const out = m ? m[1].replace(/€\s/, '€').replace(/ per | a | an | al /i, '/') : s;
  return out.length > 12 ? out.slice(0, 11).trimEnd() + '…' : out;
}
// Amounts: "11", "11.50", "1,200".
const euros = (n) => {
  const v = Number(n);
  return v.toLocaleString('en-GB', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
};
const range = (a, b) => (b != null && Number(b) !== Number(a) ? `${euros(a)}–${euros(b)}` : euros(a));
// Hours in a month at this many hours a week (52 weeks / 12 months).
export const monthlyHours = (hoursPerWeek) => (hoursPerWeek * 52) / 12;

// "€11–13/h", "€600/month (≈ €12/h)", "€500 per project",
// "Curricular internship (unpaid)". Jobs from before structured pay show
// their pay text, or "Pay not listed".
export function payLabel(job) {
  switch (job.pay_unit) {
    case 'hour':
      return `€${range(job.pay_min, job.pay_max)}/h`;
    case 'month': {
      const h = Number(job.hours_per_week);
      const per = (x) => Math.round(Number(x) / monthlyHours(h));
      const approx = Number.isInteger(h) && h > 0
        ? ` (≈ €${job.pay_max != null && per(job.pay_max) !== per(job.pay_min) ? `${per(job.pay_min)}–${per(job.pay_max)}` : per(job.pay_min)}/h)`
        : '';
      return `€${range(job.pay_min, job.pay_max)}/month${approx}`;
    }
    case 'project':
      return `€${range(job.pay_min, job.pay_max)} per project`;
    case 'unpaid_curricular':
      return 'Curricular internship (unpaid)';
    default:
      return job.pay || 'Pay not listed';
  }
}
// The free-text pay is a note ("+ tips") once the pay is structured.
export const payNote = (job) => (job.pay_unit && job.pay ? job.pay : null);
// Short, for a map marker: "€11–13/h", "€600+/mo", "€500/proj", "Unpaid".
export function markerPay(job) {
  const plus = job.pay_max != null && Number(job.pay_max) !== Number(job.pay_min) ? '+' : '';
  switch (job.pay_unit) {
    case 'hour':
      return `€${range(job.pay_min, job.pay_max)}/h`;
    case 'month':
      return `€${euros(job.pay_min)}${plus}/mo`;
    case 'project':
      return `€${euros(job.pay_min)}${plus}/proj`;
    case 'unpaid_curricular':
      return 'Unpaid';
    default:
      return shortPay(job.pay);
  }
}
// When a job went live: its first publication, or when it was written for a
// job without one (and in the employer's preview, which isn't published).
export const postedAt = (job) => job.published_at || job.created_at;
export function postedLabel(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
// start_date is a plain date (YYYY-MM-DD); read it as a local date.
export function dateLabel(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
// Company websites may be stored without https://. Only http(s) is linked.
export function websiteHref(site) {
  const s = String(site || '').trim();
  if (!s) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return safeHttpUrl(s);
  return safeHttpUrl('https://' + s.replace(/^\/+/, ''));
}
export function websiteText(site) {
  return String(site || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

// One approved company for its public page (never its contact email), or null.
export async function fetchCompany(id) {
  if (!UUID.test(id || '')) return null;
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, website, description, status')
    .eq('id', id)
    .eq('status', 'approved')
    .maybeSingle();
  if (error) throw error;
  return data;
}

// "Open in Google Maps": a plain link, so nothing is sent to Google unless
// the person clicks it.
export function googleMapsHref(job) {
  return `https://www.google.com/maps/search/?api=1&query=${job.latitude},${job.longitude}`;
}
