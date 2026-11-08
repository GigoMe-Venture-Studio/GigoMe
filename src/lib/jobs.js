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

// Filters live in the URL (?q=barista&type=part_time&remote=yes&italian=none&hours=20)
// so a filtered list can be shared. Unknown values are ignored.
export function readFilters(params) {
  const type = params.get('type');
  const remote = params.get('remote');
  const italian = params.get('italian');
  const hours = Number(params.get('hours'));
  return {
    q: cleanKeyword(params.get('q')),
    type: JOB_TYPE_LABEL[type] ? type : '',
    remote: remote === 'yes' || remote === 'no' ? remote : '',
    italian: italian === 'none' || italian === 'basic' ? italian : '',
    hours: Number.isInteger(hours) && hours >= 1 && hours <= 40 ? String(hours) : ''
  };
}
export function filtersToParams(filters) {
  const out = {};
  if (filters.q) out.q = filters.q;
  if (filters.type) out.type = filters.type;
  if (filters.remote) out.remote = filters.remote;
  if (filters.italian) out.italian = filters.italian;
  if (filters.hours) out.hours = filters.hours;
  return out;
}
export function hasFilters(filters) {
  return Boolean(filters.q || filters.type || filters.remote || filters.italian || filters.hours);
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
  let query = liveJobs(
    'id, title, job_type, location, remote, hours_per_week, pay, italian_level, created_at, companies!inner(name, status)'
  );
  // Keyword: matches the title or the description, ignoring case.
  const q = cleanKeyword(filters.q);
  if (q) query = query.or(`title.ilike."*${q}*",description.ilike."*${q}*"`);
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
  const { data, error } = await liveJobs(
    'id, title, description, job_type, location, remote, hours_per_week, pay, italian_level, start_date, created_at, ' +
      'companies!inner(name, website, description, status)'
  )
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

export function placeLabel(job) {
  if (job.remote) return job.location ? `Remote or ${job.location}` : 'Remote';
  return job.location || 'Location not listed';
}
export function hoursLabel(job) {
  return `${job.hours_per_week} h/week`;
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
