// The employer side: a company account's company and jobs.
import { supabase } from './supabase.js';
import { CONTACT_EMAIL } from './contact.js';
import { t } from './i18n.js';

// contact_email isn't readable directly: get_company_contact_email() returns it
// to the owner (and admins).
const COMPANY_COLUMNS = 'id, name, website, description, status';
const JOB_COLUMNS =
  'id, title, description, job_type, location, remote, hours_per_week, pay, italian_level, start_date, expires_at, ' +
  'status, created_at, review_note, reviewed_at, area_id, latitude, longitude, show_exact_location, category, schedule, languages, ' +
  'pay_unit, pay_min, pay_max, pay_hourly';

// { [status]: { label, text } }, read in the current language each time
// (COMPANY_STATUS[status].label, JOB_STATUS[status].text).
function statusTable(prefix, values) {
  const table = {};
  for (const v of values) {
    table[v] = {
      get label() {
        return t(`${prefix}.${v}.label`);
      },
      get text() {
        return t(`${prefix}.${v}.text`, { email: CONTACT_EMAIL });
      }
    };
  }
  return table;
}

export const COMPANY_STATUS = statusTable('employer.companyStatus', ['pending', 'approved', 'rejected']);

export const JOB_STATUS = statusTable('employer.jobStatus', [
  'draft',
  'pending',
  'published',
  'expired',
  'changes_requested',
  'rejected',
  'closed'
]);

// 'expired' for a published job past its end date, otherwise the status.
export function shownStatus(job) {
  if (job.status === 'published' && new Date(job.expires_at).getTime() <= Date.now()) return 'expired';
  return job.status;
}

export const HOURS_HINT_ABOVE = 20;

// The caller's company (with its contact email), or null.
export async function fetchMyCompany(userId, { withEmail = true } = {}) {
  const { data, error } = await supabase.from('companies').select(COMPANY_COLUMNS).eq('owner_id', userId).maybeSingle();
  if (error) throw error;
  if (!data || !withEmail) return data;
  const email = await supabase.rpc('get_company_contact_email', { p_company_id: data.id });
  if (email.error) throw email.error;
  return { ...data, contact_email: email.data || '' };
}

// Creates the company (status pending: only admins change it).
export async function createCompany(fields) {
  const { data, error } = await supabase.from('companies').insert(fields).select(COMPANY_COLUMNS).single();
  if (error) throw error;
  return { ...data, contact_email: fields.contact_email };
}

export async function updateCompany(id, fields) {
  const { data, error } = await supabase.from('companies').update(fields).eq('id', id).select(COMPANY_COLUMNS).single();
  if (error) throw error;
  return { ...data, contact_email: fields.contact_email };
}

export async function fetchMyJobs(companyId) {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// { [jobId]: clicks } for the caller's own jobs.
export async function fetchMyJobStats() {
  const { data, error } = await supabase.rpc('my_job_stats');
  if (error) throw error;
  return Object.fromEntries((data || []).map((r) => [r.job_id, Number(r.apply_clicks) || 0]));
}

export async function fetchMyJob(companyId, id) {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS)
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const contact = await supabase.rpc('get_own_job_contact', { p_job_id: id });
  if (contact.error) throw contact.error;
  const row = (contact.data || [])[0] || {};
  return { ...data, apply_url: row.apply_url || '', apply_email: row.apply_email || '' };
}

// Saves a job and how to apply. The job is saved as a draft first and only
// then given its final status, so a job is never submitted without the
// contact that goes with it. Returns the job id.
export async function saveJob({ companyId, id, fields, contact, status, currentStatus }) {
  let jobId = id;
  if (!jobId) {
    const { data, error } = await supabase
      .from('jobs')
      .insert({ ...fields, company_id: companyId, status: 'draft' })
      .select('id')
      .single();
    if (error) throw error;
    jobId = data.id;
  } else {
    // A published job can't be edited and stay published: the fields and the
    // new status go in one update.
    const first = currentStatus === 'published' ? status : 'draft';
    const { error } = await supabase.from('jobs').update({ ...fields, status: first }).eq('id', jobId);
    if (error) throw error;
  }
  const { error: contactError } = await supabase.rpc('set_job_contact', {
    p_job_id: jobId,
    p_apply_url: contact.url || null,
    p_apply_email: contact.email || null
  });
  if (contactError) throw Object.assign(contactError, { savedJobId: jobId });
  if (status !== 'draft' && currentStatus !== 'published') {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', jobId);
    if (error) throw Object.assign(error, { savedJobId: jobId });
  }
  return jobId;
}

export async function setJobStatus(id, status) {
  const { error } = await supabase.from('jobs').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteDraft(id) {
  const { error, count } = await supabase.from('jobs').delete({ count: 'exact' }).eq('id', id).eq('status', 'draft');
  if (error) throw error;
  if (count === 0) throw new Error('not deleted');
}

// A website or apply link as typed (adds https://; null when it isn't one).
export { normalizeUrl } from './links.js';

// "Extend by 60 days": a published job of the caller's own approved company
// is shown until 60 days from now, without a new review (the database's
// extend_my_job() checks all of that). Returns the new end as an ISO string.
export async function extendJob(id) {
  const { data, error } = await supabase.rpc('extend_my_job', { p_job_id: id });
  if (error) throw error;
  return data;
}

// A job can be extended while live and up to 14 days after it expired (the
// database's extend_my_job() has the same rule); after that it goes back to
// review: edit it and submit it again.
export const EXTEND_GRACE_DAYS = 14;
export function canExtend(job, now = Date.now()) {
  return job.status === 'published' && new Date(job.expires_at).getTime() >= now - EXTEND_GRACE_DAYS * 86400000;
}

// "Expires today", "Expires tomorrow", "Expires in 12 days" (null once past).
export function expiresInLabel(iso, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (!(ms > 0)) return null;
  const days = Math.floor(ms / 86400000);
  if (days === 0) return t('employer.expiresToday');
  if (days === 1) return t('employer.expiresTomorrow');
  return t('employer.expiresIn', { count: days });
}

// How many students follow the caller's company: a number, never who.
export async function fetchFollowerCount() {
  const { data, error } = await supabase.rpc('my_company_follower_count');
  if (error) throw error;
  return Number(data) || 0;
}
