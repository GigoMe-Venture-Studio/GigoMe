import { useEffect, useRef, useState } from 'react';
import { createMap, maplibregl } from '../lib/map.js';
import { payLabel, placeLabel } from '../lib/jobs.js';

// The map on /jobs and on company pages. Loaded with React.lazy, so MapLibre
// is only downloaded when a map is shown. It shows exactly the jobs it is
// given (the list's jobs, with every filter applied), minus remote jobs and
// jobs without coordinates. Markers cluster when zoomed out; a marker opens a
// small card with a link to the job.
const ACCENT = '#A67CBA';
const INK = '#1D1B2E';

export function mappableJobs(jobs) {
  return jobs.filter((j) => !j.remote && j.latitude != null && j.longitude != null);
}

function toGeoJSON(jobs) {
  return {
    type: 'FeatureCollection',
    features: mappableJobs(jobs).map((j) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [j.longitude, j.latitude] },
      properties: { id: j.id }
    }))
  };
}

// A job card for the popup, built as plain DOM (MapLibre owns the popup).
function cardFor(job, onOpenJob) {
  const box = document.createElement('div');
  box.className = 'map-card';
  const a = document.createElement('a');
  a.href = `/jobs/${job.id}`;
  a.className = 'map-card-title';
  a.textContent = job.title;
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onOpenJob(job.id);
  });
  const co = document.createElement('p');
  co.className = 'map-card-co';
  co.textContent = job.companies ? job.companies.name : '';
  const meta = document.createElement('p');
  meta.className = 'map-card-meta';
  meta.textContent = `${payLabel(job)} · ${placeLabel(job)}`;
  box.append(a, co, meta);
  return box;
}

export default function JobsMap({ jobs, onOpenJob, label = 'Map of the jobs' }) {
  const box = useRef(null);
  const map = useRef(null);
  const popup = useRef(null);
  const byId = useRef(new Map());
  const latest = useRef({ jobs, onOpenJob });
  latest.current = { jobs, onOpenJob };
  const [state, setState] = useState('loading');

  // Create the map once.
  useEffect(() => {
    let m;
    try {
      m = createMap(box.current);
    } catch {
      setState('error');
      return undefined;
    }
    map.current = m;
    m.on('error', (e) => {
      // A missing tile or font is not fatal; a style that can't load is.
      if (!m.isStyleLoaded() && !m.getSource('jobs')) setState('error');
      if (e && e.error && /style/i.test(String(e.error.message || ''))) setState('error');
    });
    m.on('load', () => {
      m.addSource('jobs', { type: 'geojson', data: toGeoJSON(latest.current.jobs), cluster: true, clusterRadius: 44, clusterMaxZoom: 15 });
      m.addLayer({
        id: 'job-clusters',
        type: 'circle',
        source: 'jobs',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ACCENT,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF'
        }
      });
      m.addLayer({
        id: 'job-cluster-count',
        type: 'symbol',
        source: 'jobs',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 13 },
        paint: { 'text-color': INK }
      });
      m.addLayer({
        id: 'job-points',
        type: 'circle',
        source: 'jobs',
        filter: ['!', ['has', 'point_count']],
        paint: { 'circle-color': INK, 'circle-radius': 8, 'circle-stroke-width': 3, 'circle-stroke-color': ACCENT }
      });

      const openPopup = (lngLat, content) => {
        if (popup.current) popup.current.remove();
        popup.current = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', offset: 12 })
          .setLngLat(lngLat)
          .setDOMContent(content)
          .addTo(m);
      };
      m.on('click', 'job-points', (e) => {
        const f = e.features && e.features[0];
        const job = f && byId.current.get(f.properties.id);
        if (job) openPopup(f.geometry.coordinates, cardFor(job, latest.current.onOpenJob));
      });
      m.on('click', 'job-clusters', async (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        const source = m.getSource('jobs');
        const clusterId = f.properties.cluster_id;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        if (zoom <= m.getMaxZoom() && zoom > m.getZoom() + 0.01) {
          m.easeTo({ center: f.geometry.coordinates, zoom });
          return;
        }
        // Jobs at the same spot (e.g. several jobs shown at an area's centre):
        // list them instead of zooming forever.
        const leaves = await source.getClusterLeaves(clusterId, 50, 0);
        const list = document.createElement('div');
        list.className = 'map-card-list';
        for (const leaf of leaves) {
          const job = byId.current.get(leaf.properties.id);
          if (job) list.append(cardFor(job, latest.current.onOpenJob));
        }
        openPopup(f.geometry.coordinates, list);
      });
      for (const layer of ['job-points', 'job-clusters']) {
        m.on('mouseenter', layer, () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', layer, () => { m.getCanvas().style.cursor = ''; });
      }
      // How many clusters are drawn right now (for checking the map).
      m.on('idle', () => {
        if (box.current) box.current.dataset.clusters = String(m.queryRenderedFeatures({ layers: ['job-clusters'] }).length);
      });
      setState('ready');
      fit(m, latest.current.jobs);
    });
    return () => {
      if (popup.current) popup.current.remove();
      m.remove();
      map.current = null;
    };
  }, []);

  // New jobs (filters changed): new data, new view.
  useEffect(() => {
    byId.current = new Map(jobs.map((j) => [j.id, j]));
    const m = map.current;
    const source = m && m.getSource && m.getSource('jobs');
    if (!source) return;
    if (popup.current) popup.current.remove();
    source.setData(toGeoJSON(jobs));
    fit(m, jobs);
  }, [jobs]);

  const count = mappableJobs(jobs).length;
  return (
    <div className="jobs-map-wrap">
      <div ref={box} className="jobs-map" role="region" aria-label={label} data-state={state} data-points={count} />
      {state === 'error' && (
        <p className="jobs-map-note" role="alert">The map can't be shown right now. The list has every job.</p>
      )}
      {state === 'ready' && count === 0 && (
        <p className="jobs-map-note">None of these jobs has a place on the map.</p>
      )}
    </div>
  );
}

function fit(m, jobs) {
  const pts = mappableJobs(jobs).map((j) => [j.longitude, j.latitude]);
  if (!pts.length) return;
  if (pts.length === 1) {
    m.jumpTo({ center: pts[0], zoom: 14 });
    return;
  }
  const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
  for (const p of pts) b.extend(p);
  m.fitBounds(b, { padding: 48, maxZoom: 15, duration: 0 });
}
