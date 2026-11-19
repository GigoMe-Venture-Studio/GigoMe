// Milan areas (public.areas): readable by everyone, changed only in the
// Supabase dashboard. Loaded once per page load and shared.
import { supabase } from './supabase.js';
import { getLang, t } from './i18n.js';

// Area names are Milan's own (Brera, Navigli ...), except the catch-all
// "Elsewhere in Milan", shown in Italian when the site is.
export const areaName = (name) => (name === 'Elsewhere in Milan' && getLang() === 'it' ? t('area.elsewhere') : name); // i18n-ignore: the database's name
const withName = (row) => {
  const stored = row.name;
  return Object.defineProperty({ ...row }, 'name', { get: () => areaName(stored), enumerable: true });
};

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
        return (data || []).map(withName);
      })
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}
