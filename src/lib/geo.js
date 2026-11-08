// Small geometry helpers for pages that may not show a map. Kept apart from
// map.js so importing them never pulls MapLibre into the page's code.

// Distance in metres between two [lng, lat] points (haversine).
export function metresBetween(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// "350 m away", "1.2 km away".
export function distanceLabel(m) {
  if (m < 1000) return `${Math.max(50, Math.round(m / 50) * 50)} m away`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km away`;
}

// Where the map can go (a little more than the Milan metro area).
export const MAP_LIMITS = [8.4, 45.1, 9.9, 45.85];
export const inLimits = ([lng, lat]) => lng >= MAP_LIMITS[0] && lng <= MAP_LIMITS[2] && lat >= MAP_LIMITS[1] && lat <= MAP_LIMITS[3];

// The map position in the URL: ?map=zoom/lat/lng (like openstreetmap.org).
export function readMapParam(value) {
  const m = /^(\d{1,2}(?:\.\d+)?)\/(-?\d{1,2}\.\d+)\/(-?\d{1,3}\.\d+)$/.exec(value || '');
  if (!m) return null;
  const zoom = Number(m[1]), lat = Number(m[2]), lng = Number(m[3]);
  if (zoom < 8 || zoom > 18 || !inLimits([lng, lat])) return null;
  return { center: [lng, lat], zoom };
}
export function mapParam({ center, zoom }) {
  return `${zoom.toFixed(1)}/${center[1].toFixed(4)}/${center[0].toFixed(4)}`;
}

// bounds: [west, south, east, north]
export const inBounds = (job, b) => job.longitude >= b[0] && job.longitude <= b[2] && job.latitude >= b[1] && job.latitude <= b[3];
