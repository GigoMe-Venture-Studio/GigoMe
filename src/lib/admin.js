// /admin: moderation. Every call here is checked again by the database
// (is_admin() in the policies and functions), so a non-admin gets nothing.
import { supabase } from './supabase.js';

const JOB_COLUMNS =
  'id, title, description, job_type, location, remote, hours_per_week, pay, italian_level, start_date, expires_at, ' +
  'status, created_at, review_note, reviewed_at, area_id, latitude, longitude, show_exact_location, category, schedule, languages, ' +
  'pay_unit, pay_min, pay_max, pay_hourly, is_example, areas(name), ' +
  'companies(id, name, website, description, status, is_example)';

// What reviewers check, in the same words /how-it-works and /safety promise
// students and employers (change them together). Display only for
// companies; the job review's five boxes (company + job) must all be ticked
// before Publish, as before.
export const COMPANY_CHECKS = ['Login email, website and description match'];
export const JOB_CHECKS = [
  'Role clearly described',
  'Pay and hours stated',
  'Nothing asked of students up front (fees, deposits, documents)',
  'Nothing discriminatory or unlawful'
];
export const REVIEW_CHECKLIST = ['Company: ' + COMPANY_CHECKS[0].charAt(0).toLowerCase() + COMPANY_CHECKS[0].slice(1), ...JOB_CHECKS];

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

// Live jobs missing what the database now requires to submit or publish: an
// area (on-site jobs), a schedule or structured pay. They were published
// before those rules. Without an area they don't show on the map or in area
// searches; without a schedule they don't match the "When" filter; without
// structured pay they don't match "Minimum pay". Ask the employer to add them.
export async function fetchLiveJobsMissingInfo() {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, created_at, remote, area_id, schedule, pay_unit, companies!inner(name, status)')
    .eq('status', 'published')
    .or('and(remote.eq.false,area_id.is.null),schedule.eq.{},pay_unit.is.null')
    .gt('expires_at', new Date().toISOString())
    .eq('companies.status', 'approved')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// What the database still needs before it lets a job be published.
export function missingInfo(job) {
  const out = [];
  if (!job.remote && job.area_id == null) out.push('area');
  if (!job.schedule || !job.schedule.length) out.push('schedule');
  if (!job.pay_unit) out.push('structured pay');
  return out;
}

export async function fetchOpenReports() {
  const { data, error } = await supabase
    .from('job_reports')
    .select('id, reason, details, created_at, reporter_id, job_title, company_name, jobs(' + JOB_COLUMNS + ')')
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
    .select('id, created_at, admin_id, action, note, companies(name, is_example), jobs(title, is_example)')
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

// The newest feedback messages: page and time only, never who sent them.
export const FEEDBACK_SHOWN = 50;
export async function fetchRecentFeedback() {
  const { data, error } = await supabase
    .from('feedback')
    .select('id, page, message, created_at')
    .order('created_at', { ascending: false })
    .limit(FEEDBACK_SHOWN);
  if (error) throw error;
  return data || [];
}

// Students by how their account was verified and by university, and the
// university names typed under "Other" with counts (admin_student_counts(),
// admin_other_universities()). Admins only; the database refuses anyone else.
export const VERIFICATION_LABELS = {
  university_email: 'University email',
  self_declared: 'Told us (any email)'
};
export async function fetchStudentBreakdown() {
  const [counts, others] = await Promise.all([
    supabase.rpc('admin_student_counts'),
    supabase.rpc('admin_other_universities')
  ]);
  if (counts.error) throw counts.error;
  if (others.error) throw others.error;
  // One row per university: { university, university_email, self_declared, total }.
  const byUni = new Map();
  for (const r of counts.data || []) {
    const key = r.university || '';
    const row = byUni.get(key) || { university: r.university, university_email: 0, self_declared: 0, total: 0 };
    row[r.verification] = (row[r.verification] || 0) + Number(r.students);
    row.total += Number(r.students);
    byUni.set(key, row);
  }
  const rows = [...byUni.values()].sort((a, b) => {
    const rank = (u) => (u === null ? 2 : u === 'Other' ? 1 : 0); // listed universities, Other, not answered
    return rank(a.university) - rank(b.university) || b.total - a.total || String(a.university).localeCompare(String(b.university));
  });
  const totals = rows.reduce((t, r) => ({
    university_email: t.university_email + r.university_email,
    self_declared: t.self_declared + r.self_declared,
    total: t.total + r.total
  }), { university_email: 0, self_declared: 0, total: 0 });
  return { rows, totals, others: (others.data || []).map((o) => ({ name: o.name, students: Number(o.students) })) };
}

// The numbers at the top of /admin (admin_stats(), the same definitions as
// supabase/queries/kpis.sql). Admins only; the database refuses anyone else.
export async function fetchStats() {
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) throw error;
  return (data || [])[0] || null;
}
