import { useEffect, useRef, useState } from 'react';
import { createMap, maplibregl } from '../lib/map.js';

// The small map on a job page. Loaded with React.lazy, and only once it is
// about to scroll into view. An exact location gets a pin and, within about
// 1 km, its nearest metro station; a job that shows only its area gets a
// circle around the area's centre (never a pin: the database stores no
// exact point for it).
const AREA_RADIUS_M = 600;

function circle([lng, lat], metres, steps = 64) {
  const dLat = metres / 110540;
  const dLng = metres / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

export default function JobPlaceMap({ point, exact, station, title }) {
  const box = useRef(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let m;
    try {
      // Two fingers (or Ctrl + scroll) to move it, so the page still scrolls.
      m = createMap(box.current, { center: point, zoom: exact ? 15 : 13.5, cooperativeGestures: true });
    } catch {
      setState('error');
      return undefined;
    }
    m.on('error', () => {
      if (!m.isStyleLoaded()) setState('error');
    });
    m.on('load', () => {
      if (exact) {
        const pin = document.createElement('div');
        pin.className = 'job-marker';
        pin.setAttribute('role', 'img');
        pin.setAttribute('aria-label', `Where "${title}" is`);
        const dot = document.createElement('span');
        dot.className = 'job-marker-dot';
        pin.append(dot);
        new maplibregl.Marker({ element: pin }).setLngLat(point).addTo(m);
        if (station) {
          const el = document.createElement('div');
          el.className = 'station-marker';
          el.textContent = `${station.lines.join(' ')} ${station.name}`;
          new maplibregl.Marker({ element: el, anchor: 'left', offset: [-6, 0] }).setLngLat([station.longitude, station.latitude]).addTo(m);
          const b = new maplibregl.LngLatBounds(point, point).extend([station.longitude, station.latitude]);
          // Room at the bottom for the map's credits, on the right for the label.
          m.fitBounds(b, { padding: { top: 50, bottom: 80, left: 40, right: 150 }, maxZoom: 16, duration: 0 });
        }
      } else {
        m.addSource('job-area', { type: 'geojson', data: circle(point, AREA_RADIUS_M) });
        // Dark and dashed, so it can't be mistaken for a metro line (M5 is lilac).
        m.addLayer({ id: 'job-area-fill', type: 'fill', source: 'job-area', paint: { 'fill-color': '#1D1B2E', 'fill-opacity': 0.08 } });
        m.addLayer({ id: 'job-area-line', type: 'line', source: 'job-area', paint: { 'line-color': '#1D1B2E', 'line-width': 2, 'line-dasharray': [2, 2] } });
      }
      setState('ready');
    });
    return () => m.remove();
    // One map per job page; the page remounts it for another job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="job-map-wrap">
      <div ref={box} className="job-map" role="region" aria-label={exact ? 'Map: where the job is' : 'Map: the area of the job'}
        data-state={state} data-exact={String(exact)} />
      {state === 'error' && <p className="jobs-map-note" role="alert">The map can't be shown right now.</p>}
    </div>
  );
}
