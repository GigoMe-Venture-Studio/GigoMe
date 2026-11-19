// "Report this job": logged-in users report a live job. Only admins read
// reports (job_reports, admin-only RLS).
import { dailyLimitMessage } from './limits.js';
import { supabase } from './supabase.js';
import { labelMap, labelPairs, t } from './i18n.js';

// Values allowed by job_reports.reason; labels: report.reason.* in the
// translation files.
const REASON_VALUES = ['scam', 'illegal', 'misleading', 'discriminatory', 'other'];
export const REPORT_REASONS = labelPairs('report.reason', REASON_VALUES);
export const REPORT_REASON_LABEL = labelMap('report.reason', REASON_VALUES);
export const REPORT_DETAILS_MAX = 2000;

// Returns null when sent, or an error message.
export async function reportJob(jobId, reason, details) {
  const { error } = await supabase
    .from('job_reports')
    .insert({ job_id: jobId, reason, details: String(details || '').trim() || null });
  if (!error) return null;
  // One open report per user per job (unique index).
  if (error.code === '23505') return t('report.already');
  if (dailyLimitMessage(error)) return dailyLimitMessage(error);
  return t('report.sendError');
}
