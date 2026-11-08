// Saved jobs (public.saved_jobs): one shared list of the logged-in student's
// saved job ids, loaded once per login, so every card and page agrees and
// the database is asked once. Only students can save (the database checks).
import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase.js';
import { useSession } from './useSession.js';
import { fetchProfile } from './auth.js';

let state = { userId: null, canSave: false, ids: new Set(), loaded: false, error: '' };
let loading = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const set = (patch) => {
  state = { ...state, ...patch };
  emit();
};

async function loadFor(userId) {
  if (state.userId === userId && (state.loaded || loading)) return loading;
  set({ userId, canSave: false, ids: new Set(), loaded: false, error: '' });
  if (!userId || !supabase) {
    set({ loaded: true });
    return null;
  }
  loading = (async () => {
    try {
      const profile = await fetchProfile(userId);
      if (!profile || profile.account_type !== 'student') {
        if (state.userId === userId) set({ loaded: true });
        return;
      }
      const { data, error } = await supabase.from('saved_jobs').select('job_id');
      if (error) throw error;
      if (state.userId === userId) set({ canSave: true, ids: new Set((data || []).map((r) => r.job_id)), loaded: true });
    } catch {
      if (state.userId === userId) set({ loaded: true, error: "We couldn't load your saved jobs." });
    } finally {
      loading = null;
    }
  })();
  return loading;
}

// Saves or removes a job. Shows the change at once and undoes it if the
// database refuses. Returns an error message or null.
export async function setSaved(jobId, save) {
  const before = state.ids;
  const ids = new Set(before);
  if (save) ids.add(jobId);
  else ids.delete(jobId);
  set({ ids });
  const { error } = save
    ? await supabase.from('saved_jobs').insert({ job_id: jobId })
    : await supabase.from('saved_jobs').delete().eq('job_id', jobId);
  // Already saved (another tab): that's what was wanted.
  if (error && !(save && error.code === '23505')) {
    set({ ids: before });
    return save ? "We couldn't save this job. Try again." : "We couldn't remove this job. Try again.";
  }
  return null;
}

// { canSave, loaded, isSaved(id) } for the logged-in user.
export function useSavedJobs() {
  const { session, loading } = useSession();
  const userId = session ? session.user.id : null;
  useEffect(() => {
    if (!loading) loadFor(userId);
  }, [userId, loading]);
  const snap = useSyncExternalStore(subscribe, () => state);
  const current = snap.userId === userId;
  return {
    canSave: current && snap.canSave,
    loaded: current && snap.loaded,
    error: current ? snap.error : '',
    isSaved: (id) => current && snap.ids.has(id),
    ids: current ? snap.ids : new Set()
  };
}

// The student's saved jobs with title, company and whether they're still live.
export async function fetchSavedList() {
  const { data, error } = await supabase.rpc('my_saved_jobs');
  if (error) throw error;
  return data || [];
}
