// "Find address" on the job form: one lookup through OpenStreetMap's
// Nominatim, only when the employer presses the button. Its usage policy
// (https://operations.osmfoundation.org/policies/nominatim/) allows this: no
// autocomplete, at most one request a second (the button waits), the site is
// identified by the browser's Referer, and the result is credited on the form.
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const MIN_GAP_MS = 1100;
let last = 0;

// { lat, lon, label } inside the Milan metro area, or null when not found.
export async function findAddress(text) {
  const q = String(text || '').trim();
  if (!q) return null;
  const wait = last + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const params = new URLSearchParams({
    q: /milan/i.test(q) ? q : `${q}, Milano`,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'it',
    viewbox: '8.70,45.70,9.60,45.25',
    bounded: '1',
    'accept-language': 'en'
  });
  const res = await fetch(`${ENDPOINT}?${params}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const rows = await res.json();
  const hit = rows && rows[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!(lat >= 45.25 && lat <= 45.7 && lon >= 8.7 && lon <= 9.6)) return null;
  return { lat, lon, label: hit.display_name || q };
}
