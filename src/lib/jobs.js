// The job board: reading live jobs and revealing how to apply.
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

// Columns every job list and page reads (jobs have column-level grants: list
// them, never select *).
const LIST_COLUMNS =
  'id, title, job_type, location, remote, hours_per_week, pay, italian_level, created_at, category, published_at, ' +
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

// Filters live in the URL (?q=barista&area=3&type=part_time&remote=yes&italian=none&hours=20)
// so a filtered list can be shared. Unknown values are ignored. area is an
// areas.id (see src/lib/areas.js).
export function readFilters(params) {
  const area = Number(params.get('area'));
  const category = params.get('category');
  const type = params.get('type');
  const remote = params.get('remote');
  const italian = params.get('italian');
  const hours = Number(params.get('hours'));
  return {
    q: cleanKeyword(params.get('q')),
    area: Number.isInteger(area) && area >= 1 && area <= 32767 ? String(area) : '',
    category: CATEGORY_LABEL[category] ? category : '',
    type: JOB_TYPE_LABEL[type] ? type : '',
    remote: remote === 'yes' || remote === 'no' ? remote : '',
    italian: italian === 'none' || italian === 'basic' ? italian : '',
    hours: Number.isInteger(hours) && hours >= 1 && hours <= 40 ? String(hours) : ''
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
  return out;
}
export function hasFilters(filters) {
  return Boolean(filters.q || filters.area || filters.category || filters.type || filters.remote || filters.italian || filters.hours);
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
  let query = liveJobs(LIST_COLUMNS + ', companies!inner(name, status)');
  // Keyword: matches the title or the description, ignoring case.
  const q = cleanKeyword(filters.q);
  if (q) query = query.or(`title.ilike."*${q}*",description.ilike."*${q}*"`);
  if (filters.area) query = query.eq('area_id', Number(filters.area));
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.companyId) query = query.eq('company_id', filters.companyId);
  if (filters.ids) query = query.in('id', filters.ids);
  if (filters.type) query = query.eq('job_type', filters.type);
  if (filters.remote === 'yes') query = query.eq('remote', true);
  if (filters.remote === 'no') query = query.eq('remote', false);
  if (filters.italian === 'none') query = query.eq('italian_level', 'none');
  if (filters.italian === 'basic') query = query.in('italian_level', ['none', 'basic']);
  if (filters.hours) query = query.lte('hours_per_week', Number(filters.hours));
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One live job, or null when it doesn't exist or isn't live.
export async function fetchJob(id) {
  if (!UUID.test(id || '')) return null;
  // The job page also needs the station's position, for its small map.
  const columns = LIST_COLUMNS.replace('metro_stations(name, lines)', 'metro_stations(name, lines, latitude, longitude)');
  const { data, error } = await liveJobs(columns + ', description, start_date, companies!inner(id, name, website, description, status)')
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
  return { url: row.apply_url || null, email: row.apply_email || null };
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
export function payLabel(job) {
  return job.pay || 'Pay not listed';
}
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
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null;
  return 'https://' + s.replace(/^\/+/, '');
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
