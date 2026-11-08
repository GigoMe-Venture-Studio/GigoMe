// "Report this job": logged-in users report a live job. Only admins read
// reports (job_reports, admin-only RLS).
import { supabase } from './supabase.js';

export const REPORT_REASONS = [
  ['scam', 'Scam, or payment demanded from students'],
  ['illegal', 'Illegal or unsafe'],
  ['misleading', 'Misleading pay or hours'],
  ['discriminatory', 'Discriminatory'],
  ['other', 'Something else']
];
export const REPORT_REASON_LABEL = Object.fromEntries(REPORT_REASONS);
export const REPORT_DETAILS_MAX = 2000;

// Returns null when sent, or an error message.
export async function reportJob(jobId, reason, details) {
  const { error } = await supabase
    .from('job_reports')
    .insert({ job_id: jobId, reason, details: String(details || '').trim() || null });
  if (!error) return null;
  // One open report per user per job (unique index).
  if (error.code === '23505') return "You've already reported this job. We're looking into it.";
  return "We couldn't send your report. Check your connection and try again.";
}
