// The employer side: a company account's company and jobs.
import { supabase } from './supabase.js';
import { CONTACT_EMAIL } from './contact.js';

// contact_email isn't readable directly: get_company_contact_email() returns it
// to the owner (and admins).
const COMPANY_COLUMNS = 'id, name, website, description, status';
const JOB_COLUMNS =
  'id, title, description, job_type, location, remote, hours_per_week, pay, italian_level, start_date, expires_at, ' +
  'status, created_at, review_note, reviewed_at, area_id, latitude, longitude, show_exact_location, category, schedule, languages, ' +
  'pay_unit, pay_min, pay_max, pay_hourly';

export const COMPANY_STATUS = {
  pending: {
    label: 'In review',
    text: "We'll review your company, usually within 2 working days. Meanwhile you can prepare jobs as drafts."
  },
  approved: { label: 'Approved', text: 'You can submit jobs. Each job is reviewed before students see it.' },
  rejected: {
    label: 'Not approved',
    text: `We couldn't approve your company. If you think this is a mistake, write to ${CONTACT_EMAIL}.`
  }
};

export const JOB_STATUS = {
  draft: { label: 'Draft', text: 'Only you can see it. Submit it for review when it is ready.' },
  pending: { label: 'In review', text: "We're checking it, usually within 2 working days." },
  published: { label: 'Live', text: 'Students can see it and apply.' },
  expired: { label: 'Expired', text: 'Its end date has passed, so students no longer see it.' },
  changes_requested: { label: 'Changes requested', text: 'Edit it as the reviewer asked, then submit it again.' },
  rejected: { label: 'Rejected', text: "It can't be published or resubmitted." },
  closed: { label: 'Closed', text: 'Students no longer see it.' }
};

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

// How many students follow the caller's company: a number, never who.
export async function fetchFollowerCount() {
  const { data, error } = await supabase.rpc('my_company_follower_count');
  if (error) throw error;
  return Number(data) || 0;
}
