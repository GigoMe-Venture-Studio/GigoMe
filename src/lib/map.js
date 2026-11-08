// Everything MapLibre. Only ever imported with import(), so the map code and
// its CSS load when a map is first shown and the list pages stay light.
//
// Tiles: OpenFreeMap (https://openfreemap.org), style "positron". The
// attribution control shows the OpenStreetMap / OpenFreeMap credits, and the
// credit for the metro (City of Milan open data, CC BY 4.0): the lines and
// stations drawn on every map, the metro badges and the walking distances.
//
// The metro lines and stations come from a static file,
// public/metro/milan-metro.geojson, built by scripts/build-metro-map.mjs.
// Every map shows them, with a "Metro" button to hide them.
import maplibregl from './maplibre.js';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const METRO_URL = '/metro/milan-metro.geojson';
export const STATIONS_CREDIT =
  'Metro: <a href="https://dati.comune.milano.it/dataset/ds535_atm-fermate-linee-metropolitane" target="_blank" rel="noopener noreferrer">Comune di Milano</a>, ' +
  '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>';
// The lines' official colours (M1 red, M2 green, M3 yellow, M4 blue, M5 lilac).
export const LINE_COLOURS = { M1: '#E2231A', M2: '#00A04B', M3: '#F7C600', M4: '#0067B1', M5: '#9A81BE' };
export const MILAN_CENTRE = [9.19, 45.4642]; // [lng, lat], Duomo
// The Milan metro area: the same box the database accepts for job locations.
export const MILAN_BOUNDS = [
  [8.7, 45.25],
  [9.6, 45.7]
];
const INK = '#1D1B2E';
const METRO_LAYERS = ['metro-line-casing', 'metro-line', 'metro-station', 'metro-station-label'];
const METRO_PREF = 'gigome.metro';

export function createMap(container, options = {}) {
  const { metro = true, ...rest } = options;
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
    attributionControl: { compact: false, customAttribution: STATIONS_CREDIT },
    dragRotate: false,
    pitchWithRotate: false,
    ...rest
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  if (metro) {
    const toggle = new MetroToggle();
    map.addControl(toggle, 'top-right');
    // Added on 'load', before any other 'load' handler adds its layers, so the
    // metro sits under the jobs.
    map.on('load', () => addMetro(map, toggle.shown()));
    // How many metro lines and stations are drawn right now (for checking the map).
    map.on('idle', () => {
      if (map.getLayer('metro-line'))
        container.dataset.metro = String(map.queryRenderedFeatures({ layers: ['metro-line', 'metro-station'] }).length);
    });
  }
  return map;
}

function metroShown() {
  try {
    return window.localStorage.getItem(METRO_PREF) !== 'off';
  } catch {
    return true;
  }
}

function addMetro(map, shown) {
  if (map.getSource('metro')) return;
  // Lines go under the map's own labels (street and place names stay
  // readable); stations and their names go on top.
  const firstLabel = (map.getStyle().layers.find((l) => l.type === 'symbol') || {}).id;
  const visibility = shown ? 'visible' : 'none';
  const colour = ['match', ['get', 'line'], ...Object.entries(LINE_COLOURS).flat(), '#888888'];
  map.addSource('metro', { type: 'geojson', data: METRO_URL });
  map.addLayer(
    {
      id: 'metro-line-casing',
      type: 'line',
      source: 'metro',
      filter: ['==', ['get', 'kind'], 'line'],
      layout: { 'line-join': 'round', 'line-cap': 'round', visibility },
      paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 7, 17, 11] }
    },
    firstLabel
  );
  map.addLayer(
    {
      id: 'metro-line',
      type: 'line',
      source: 'metro',
      filter: ['==', ['get', 'kind'], 'line'],
      layout: { 'line-join': 'round', 'line-cap': 'round', visibility },
      paint: { 'line-color': colour, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 14, 4, 17, 7] }
    },
    firstLabel
  );
  map.addLayer({
    id: 'metro-station',
    type: 'circle',
    source: 'metro',
    minzoom: 12,
    filter: ['==', ['get', 'kind'], 'station'],
    layout: { visibility },
    paint: {
      'circle-color': '#FFFFFF',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 15, 5, 17, 7],
      'circle-stroke-color': INK,
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 2]
    }
  });
  map.addLayer({
    id: 'metro-station-label',
    type: 'symbol',
    source: 'metro',
    minzoom: 13.5,
    filter: ['==', ['get', 'kind'], 'station'],
    layout: {
      visibility,
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-anchor': 'top',
      'text-offset': [0, 0.7],
      'text-optional': true
    },
    paint: { 'text-color': '#4A4760', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 }
  });
}

export function setMetroShown(map, shown) {
  for (const id of METRO_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', shown ? 'visible' : 'none');
}

// The "Metro" button: shows or hides the lines and stations on this map, and
// remembers the choice on this device (nothing is sent anywhere).
class MetroToggle {
  shown() {
    return this._shown;
  }
  constructor() {
    this._shown = metroShown();
  }
  onAdd(map) {
    this._map = map;
    this._box = document.createElement('div');
    this._box.className = 'maplibregl-ctrl maplibregl-ctrl-group metro-toggle';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'metro-toggle-btn';
    b.textContent = 'Metro';
    b.title = 'Show or hide the metro lines';
    b.setAttribute('aria-pressed', String(this._shown));
    b.addEventListener('click', () => {
      this._shown = !this._shown;
      b.setAttribute('aria-pressed', String(this._shown));
      setMetroShown(map, this._shown);
      try {
        window.localStorage.setItem(METRO_PREF, this._shown ? 'on' : 'off');
      } catch {
        /* private mode: the choice just isn't remembered */
      }
    });
    this._box.append(b);
    return this._box;
  }
  onRemove() {
    this._box.remove();
    this._map = null;
  }
}

export { maplibregl };
