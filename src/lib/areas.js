// Milan areas (public.areas): readable by everyone, changed only in the
// Supabase dashboard. Loaded once per page load and shared.
import { supabase } from './supabase.js';

let cache = null;

export function fetchAreas() {
  if (!supabase) return Promise.resolve([]);
  if (!cache) {
    cache = supabase
      .from('areas')
      .select('id, name, latitude, longitude, sort_order')
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      })
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}
