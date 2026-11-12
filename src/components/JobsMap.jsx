import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { createMap, maplibregl } from '../lib/map.js';
import { EXAMPLE_JOB_LABEL, isExample, markerPay, metroLabel, payLabel, placeLabel } from '../lib/jobs.js';
import { mapParam } from '../lib/geo.js';

// The map on /jobs and on company pages. Loaded with React.lazy, so MapLibre
// is only downloaded when a map is shown. It shows exactly the jobs it is
// given (the list's jobs, with every filter applied), minus remote jobs and
// jobs without coordinates.
//
// Zoomed out, nearby jobs cluster into a circle with their count. A single
// job is a marker (a button) that shows its pay once zoomed in. Tapping a
// marker opens the job's card: a popup on larger screens, a card at the
// bottom of the map on phones.
//
// Optional, for /jobs: view ({ center, zoom }) to start from instead of
// fitting the jobs, autoFit (fit again when the jobs change), onViewChange
// (called after every move with the centre, zoom, bounds and whether the
// person moved the map), you ([lng, lat] of "You are here", kept only in
// memory) and children (controls drawn over the map).
const ACCENT = '#A46BD6'; // --accent in site.css (the logo's purple)
const INK = '#1D1B2E';
const PAY_ZOOM = 13;

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

// A job card for the desktop popup, built as plain DOM (MapLibre owns it).
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
  if (isExample(job)) {
    const ex = document.createElement('span');
    ex.className = 'tag tag-example map-card-example';
    ex.textContent = EXAMPLE_JOB_LABEL;
    box.append(ex);
  }
  const co = document.createElement('p');
  co.className = 'map-card-co';
  co.textContent = job.companies ? job.companies.name : '';
  const meta = document.createElement('p');
  meta.className = 'map-card-meta';
  meta.textContent = `${payLabel(job)} · ${placeLabel(job)}`;
  box.append(a, co, meta);
  const metro = metroLabel(job);
  if (metro) {
    const m = document.createElement('p');
    m.className = 'map-card-meta';
    m.textContent = metro;
    box.append(m);
  }
  return box;
}

const isPhone = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 767px)').matches;

export default function JobsMap({ jobs, onOpenJob, label = 'Map of the jobs', view = null, autoFit = true, onViewChange, you = null, children }) {
  const box = useRef(null);
  const map = useRef(null);
  const popup = useRef(null);
  const markers = useRef(new Map());
  const youMarker = useRef(null);
  // True while the map moves on its own (fitting the jobs, the first view),
  // so those moves aren't reported as the person moving the map.
  const quiet = useRef(false);
  const fitQuietly = (m, list) => {
    quiet.current = true;
    fit(m, list);
    quiet.current = false;
  };
  const byId = useRef(new Map());
  const latest = useRef({});
  latest.current = { jobs, onOpenJob, onViewChange, autoFit };
  const [state, setState] = useState('loading');
  const [sheet, setSheet] = useState(null); // job ids shown in the phone card

  // Create the map once.
  useEffect(() => {
    let m;
    try {
      m = createMap(box.current, view ? { center: view.center, zoom: view.zoom } : {});
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

    const open = (ids, lngLat) => {
      if (popup.current) popup.current.remove();
      const found = ids.map((id) => byId.current.get(id)).filter(Boolean);
      if (!found.length) return;
      if (isPhone()) {
        setSheet(found.map((j) => j.id));
        return;
      }
      let content;
      if (found.length === 1) content = cardFor(found[0], latest.current.onOpenJob);
      else {
        content = document.createElement('div');
        content.className = 'map-card-list';
        for (const job of found) content.append(cardFor(job, latest.current.onOpenJob));
      }
      popup.current = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', offset: 18 }).setLngLat(lngLat).setDOMContent(content).addTo(m);
    };

    // One marker (a button) per job that isn't in a cluster right now.
    const syncMarkers = () => {
      if (!m.getSource('jobs')) return;
      const seen = new Set();
      for (const f of m.querySourceFeatures('jobs')) {
        if (f.properties.cluster) continue;
        const id = f.properties.id;
        if (seen.has(id)) continue;
        seen.add(id);
        if (markers.current.has(id)) continue;
        const job = byId.current.get(id);
        if (!job) continue;
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'job-marker';
        el.dataset.id = id;
        const pay = markerPay(job);
        el.setAttribute('aria-label', `${job.title}${job.companies ? `, ${job.companies.name}` : ''}${pay ? `, ${payLabel(job)}` : ''}`);
        const dot = document.createElement('span');
        dot.className = 'job-marker-dot';
        el.append(dot);
        if (pay) {
          const t = document.createElement('span');
          t.className = 'job-marker-pay';
          t.textContent = pay;
          el.append(t);
        }
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          open([id], [job.longitude, job.latitude]);
        });
        markers.current.set(id, new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([job.longitude, job.latitude]).addTo(m));
      }
      for (const [id, mk] of markers.current) {
        if (!seen.has(id)) {
          mk.remove();
          markers.current.delete(id);
        }
      }
      if (box.current) box.current.dataset.markers = String(markers.current.size);
    };
    const payShown = () => box.current && box.current.classList.toggle('show-pay', m.getZoom() >= PAY_ZOOM);

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
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-allow-overlap': true },
        paint: { 'text-color': INK }
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
        open(leaves.map((l) => l.properties.id), f.geometry.coordinates);
      });
      m.on('mouseenter', 'job-clusters', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'job-clusters', () => { m.getCanvas().style.cursor = ''; });
      m.on('sourcedata', (e) => {
        if (e.sourceId === 'jobs' && e.isSourceLoaded) syncMarkers();
      });
      m.on('moveend', syncMarkers);
      m.on('zoom', payShown);
      // How many clusters are drawn right now (for checking the map).
      m.on('idle', () => {
        if (box.current) box.current.dataset.clusters = String(m.queryRenderedFeatures({ layers: ['job-clusters'] }).length);
      });
      m.on('moveend', (e) => {
        if (box.current) box.current.dataset.view = mapParam({ center: [m.getCenter().lng, m.getCenter().lat], zoom: m.getZoom() });
        const cb = latest.current.onViewChange;
        if (!cb) return;
        const b = m.getBounds();
        cb({
          center: [m.getCenter().lng, m.getCenter().lat],
          zoom: m.getZoom(),
          bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
          byUser: !quiet.current && !e.quiet
        });
      });
      // A tap on the map itself closes the phone card.
      m.on('click', (e) => {
        if (!m.queryRenderedFeatures(e.point, { layers: ['job-clusters'] }).length) setSheet(null);
      });
      setState('ready');
      payShown();
      if (!view) fitQuietly(m, latest.current.jobs);
      else m.fire('moveend', { quiet: true });
    });
    return () => {
      if (popup.current) popup.current.remove();
      for (const mk of markers.current.values()) mk.remove();
      markers.current.clear();
      m.remove();
      map.current = null;
    };
    // The map is created once; the props below are followed by other effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New jobs (filters changed): new data, and a new view unless the page
  // keeps the one the person chose.
  useEffect(() => {
    byId.current = new Map(jobs.map((j) => [j.id, j]));
    const m = map.current;
    const source = m && m.getSource && m.getSource('jobs');
    setSheet(null);
    if (!source) return;
    if (popup.current) popup.current.remove();
    for (const mk of markers.current.values()) mk.remove();
    markers.current.clear();
    source.setData(toGeoJSON(jobs));
    if (latest.current.autoFit) fitQuietly(m, jobs);
  }, [jobs]);

  // "You are here": a dot, and the map moves there.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (youMarker.current) youMarker.current.remove();
    youMarker.current = null;
    if (!you) return;
    const el = document.createElement('div');
    el.className = 'you-dot';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'You are here');
    el.title = 'You are here';
    youMarker.current = new maplibregl.Marker({ element: el }).setLngLat(you).addTo(m);
    m.easeTo({ center: you, zoom: Math.max(m.getZoom(), 14) });
  }, [you]);

  const count = mappableJobs(jobs).length;
  const shown = sheet ? sheet.map((id) => byId.current.get(id)).filter(Boolean) : [];
  return (
    <div className="jobs-map-wrap">
      <div ref={box} className="jobs-map" role="region" aria-label={label} data-state={state} data-points={count} />
      {children}
      {state === 'error' && (
        <p className="jobs-map-note" role="alert">The map can't be shown right now. The list has every job.</p>
      )}
      {state === 'ready' && count === 0 && (
        <p className="jobs-map-note">None of these jobs has a place on the map.</p>
      )}
      {shown.length > 0 && (
        <div className="map-sheet" role="dialog" aria-label={shown.length === 1 ? shown[0].title : `${shown.length} jobs here`}>
          <button type="button" className="map-sheet-close" aria-label="Close" onClick={() => setSheet(null)}>×</button>
          <ul className="map-sheet-list">
            {shown.map((job) => (
              <li key={job.id}>
                {isExample(job) && <span className="tag tag-example map-card-example">{EXAMPLE_JOB_LABEL}</span>}
                <Link className="map-card-title" to={`/jobs/${job.id}`}>{job.title}</Link>
                <p className="map-card-co">{job.companies ? job.companies.name : ''}</p>
                <p className="map-card-meta">{payLabel(job)} · {placeLabel(job)}</p>
                {metroLabel(job) && <p className="map-card-meta">{metroLabel(job)}</p>}
              </li>
            ))}
          </ul>
        </div>
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
