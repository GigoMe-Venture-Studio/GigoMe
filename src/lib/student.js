// What a logged-in student keeps for themselves: saved searches, followed
// companies and the jobs they opened. All in the app only: nothing is ever
// emailed. The database lets each student see only their own rows, and
// deletes them with the account.
import { dailyLimitMessage } from './limits.js';
import { supabase } from './supabase.js';
import {
  CATEGORY_LABEL,
  JOB_TYPE_LABEL,
  LANGUAGE_LABEL,
  SCHEDULE_LABEL,
  fetchJobs,
  filtersToParams,
  readFilters
} from './jobs.js';

// ---- Saved searches

export const MAX_SAVED_SEARCHES = 20;

// The /jobs filters as the query string that is saved (no map position).
export const searchParamsText = (filters) => new URLSearchParams(filtersToParams(filters)).toString();

// "“barista” · Porta Venezia · Weekends": the filters in words.
export function searchSummary(filters, areas = []) {
  const parts = [];
  if (filters.q) parts.push(`“${filters.q}”`);
  if (filters.area) parts.push((areas.find((a) => String(a.id) === filters.area) || {}).name || 'One area');
  if (filters.category) parts.push(CATEGORY_LABEL[filters.category]);
  if (filters.type) parts.push(JOB_TYPE_LABEL[filters.type]);
  if (filters.remote) parts.push(filters.remote === 'yes' ? 'Remote' : 'On site');
  if (filters.italian) parts.push(filters.italian === 'none' ? 'No Italian needed' : 'Basic Italian at most');
  if (filters.hours) parts.push(`Up to ${filters.hours} h/week`);
  if (filters.when.length) parts.push(filters.when.map((w) => SCHEDULE_LABEL[w]).join(' or '));
  if (filters.lang.length) parts.push(filters.lang.map((l) => LANGUAGE_LABEL[l]).join(' or '));
  if (filters.minpay) parts.push(`€${filters.minpay}/h or more${filters.nohourly ? ' (and jobs without an hourly pay)' : ''}`);
  return parts.join(' · ') || 'All jobs';
}

export async function saveSearch(name, filters) {
  const { error } = await supabase.from('saved_searches').insert({ name: name.trim().slice(0, 60), params: searchParamsText(filters) });
  if (error) {
    if (dailyLimitMessage(error)) throw new Error(dailyLimitMessage(error));
    if (/up to 20/i.test(error.message || '')) throw new Error(`You can save up to ${MAX_SAVED_SEARCHES} searches. Delete one on Saved jobs first.`);
    throw new Error("We couldn't save this search. Try again.");
  }
}

// Each saved search with how many matching live jobs were published since
// the student last opened it.
export async function fetchSavedSearches() {
  const { data, error } = await supabase
    .from('saved_searches')
    .select('id, name, params, created_at, last_seen_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Promise.all(
    (data || []).map(async (s) => {
      const filters = readFilters(new URLSearchParams(s.params));
      try {
        const jobs = await fetchJobs(filters);
        const since = new Date(s.last_seen_at).getTime();
        return { ...s, filters, newCount: jobs.filter((j) => j.published_at && new Date(j.published_at).getTime() > since).length };
      } catch {
        return { ...s, filters, newCount: null };
      }
    })
  );
}

// Opening a saved search: "new" counts start again from now. The database
// sets the time itself.
export async function markSearchSeen(id) {
  await supabase.from('saved_searches').update({ last_seen_at: new Date().toISOString() }).eq('id', id);
}

export async function deleteSearch(id) {
  const { error } = await supabase.from('saved_searches').delete().eq('id', id);
  if (error) throw error;
}

// ---- Following companies

export async function fetchFollows() {
  const { data, error } = await supabase
    .from('company_follows')
    .select('company_id, created_at, companies(id, name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function isFollowing(companyId) {
  const { data, error } = await supabase.from('company_follows').select('company_id').eq('company_id', companyId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function setFollowing(companyId, follow) {
  const { error } = follow
    ? await supabase.from('company_follows').insert({ company_id: companyId })
    : await supabase.from('company_follows').delete().eq('company_id', companyId);
  // Already following (another tab): that's what was wanted.
  if (error && !(follow && error.code === '23505')) throw Object.assign(new Error(dailyLimitMessage(error) || 'not saved'), { limit: Boolean(dailyLimitMessage(error)) });
}

// Live jobs from the companies the student follows, published in the last
// 14 days, newest first.
export const NEW_FROM_FOLLOWED_DAYS = 14;
export async function fetchNewFromFollowed(companyIds) {
  if (!companyIds.length) return [];
  const jobs = await fetchJobs({ companyIds });
  const since = Date.now() - NEW_FROM_FOLLOWED_DAYS * 86400000;
  return jobs
    .filter((j) => j.published_at && new Date(j.published_at).getTime() > since)
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
}

// ---- Jobs the student opened ("Apply" pressed), from their own apply clicks.
// GigoMe never knows whether they applied.

export async function fetchOpenedJobs() {
  const { data, error } = await supabase.rpc('my_opened_jobs');
  if (error) throw error;
  return data || [];
}

export const openedLabel = (iso) =>
  `You opened the application on ${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
