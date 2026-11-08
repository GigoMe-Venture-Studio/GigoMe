// /admin: moderation. Every call here is checked again by the database
// (is_admin() in the policies and functions), so a non-admin gets nothing.
import { supabase } from './supabase.js';

const JOB_COLUMNS =
  'id, title, description, job_type, location, remote, hours_per_week, pay, italian_level, start_date, expires_at, ' +
  'status, created_at, review_note, reviewed_at, area_id, latitude, longitude, show_exact_location, category, areas(name), ' +
  'companies(id, name, website, description, status)';

export const REVIEW_CHECKLIST = [
  'Employer identity is plausible (login email, website, description match)',
  'The role is real and clearly described',
  'Pay and hours are stated',
  'Nothing is demanded from students (no payment, no documents up front)',
  'Nothing discriminatory or illegal'
];

export const LOG_ACTION_LABEL = {
  company_approved: 'Company approved',
  company_rejected: 'Company rejected',
  company_pending: 'Company set back to review',
  job_published: 'Job published',
  job_changes_requested: 'Changes requested',
  job_rejected: 'Job rejected',
  job_closed: 'Job unpublished',
  job_draft: 'Job set to draft',
  job_pending: 'Job set back to review',
  report_resolved: 'Report resolved'
};

export async function checkIsAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

async function namesFor(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await supabase.from('profiles').select('id, full_name, account_type').in('id', unique);
  if (error) throw error;
  return Object.fromEntries((data || []).map((p) => [p.id, p]));
}

export async function fetchPendingCompanies() {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, website, description, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return Promise.all(
    (data || []).map(async (c) => {
      const r = await supabase.rpc('admin_company_contact', { p_company_id: c.id });
      if (r.error) throw r.error;
      const row = (r.data || [])[0] || {};
      return { ...c, contact_email: row.contact_email || '', login_email: row.login_email || '' };
    })
  );
}

async function withContact(job) {
  const r = await supabase.rpc('admin_job_contact', { p_job_id: job.id });
  if (r.error) throw r.error;
  const row = (r.data || [])[0] || {};
  return { ...job, apply_url: row.apply_url || '', apply_email: row.apply_email || '' };
}

export async function fetchPendingJobs() {
  const { data, error } = await supabase.from('jobs').select(JOB_COLUMNS).eq('status', 'pending').order('created_at', { ascending: true });
  if (error) throw error;
  return Promise.all((data || []).map(withContact));
}

export async function fetchOpenReports() {
  const { data, error } = await supabase
    .from('job_reports')
    .select('id, reason, details, created_at, reporter_id, jobs(' + JOB_COLUMNS + ')')
    .eq('status', 'open')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const names = await namesFor((data || []).map((r) => r.reporter_id));
  return Promise.all(
    (data || []).map(async (r) => ({ ...r, reporter: names[r.reporter_id] || null, jobs: r.jobs ? await withContact(r.jobs) : null }))
  );
}

export async function fetchRecentDecisions(limit = 30) {
  const { data, error } = await supabase
    .from('moderation_log')
    .select('id, created_at, admin_id, action, note, companies(name), jobs(title)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const names = await namesFor((data || []).map((r) => r.admin_id));
  return (data || []).map((r) => ({ ...r, admin: names[r.admin_id] || null }));
}

export async function setCompanyStatus(id, status) {
  const { error } = await supabase.rpc('admin_set_company_status', { p_company_id: id, p_status: status });
  if (error) throw error;
}

export async function reviewJob(id, status, note) {
  const { error } = await supabase.rpc('admin_review_job', { p_job_id: id, p_status: status, p_note: note || null });
  if (error) throw error;
}

export async function resolveReport(id, note) {
  const { error } = await supabase.rpc('admin_resolve_report', { p_report_id: id, p_note: note });
  if (error) throw error;
}
