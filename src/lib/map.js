// Everything MapLibre. Only ever imported with import(), so the map code and
// its CSS load when a map is first shown and the list pages stay light.
//
// Tiles: OpenFreeMap (https://openfreemap.org), style "positron". The
// attribution control shows the OpenStreetMap / OpenFreeMap credits.
import maplibregl from './maplibre.js';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const MILAN_CENTRE = [9.19, 45.4642]; // [lng, lat], Duomo
// The Milan metro area: the same box the database accepts for job locations.
export const MILAN_BOUNDS = [
  [8.7, 45.25],
  [9.6, 45.7]
];

export function createMap(container, options = {}) {
  const map = new maplibregl.Map({
    container,
    style: STYLE_URL,
    center: MILAN_CENTRE,
    zoom: 11,
    minZoom: 8,
    maxZoom: 18,
    maxBounds: [
      [8.4, 45.1],
      [9.9, 45.85]
    ],
    attributionControl: { compact: false },
    dragRotate: false,
    pitchWithRotate: false,
    ...options
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  return map;
}

export { maplibregl };
