#!/usr/bin/env node
// Builds public/metro/milan-metro.geojson: the M1 to M5 lines and their
// stations, drawn on every map (src/lib/map.js). A static file, so the map
// needs no database for it.
//
// Source: the City of Milan's open data (Comune di Milano, CC BY 4.0):
//   * DS535 "ATM - Fermate linee metropolitane": every stop with its lines and
//     coordinates (the same file scripts/fetch-metro-stations.mjs loads into
//     the database);
//   * DS533 "ATM - Composizione percorsi linee metropolitane": the stops of
//     each route (percorso) in order.
// A route's line is the line all its stops share. Each line is drawn as
// straight segments between consecutive stops, every segment once.
//
//   node scripts/build-metro-map.mjs                        # download both files
//   node scripts/build-metro-map.mjs stops.csv sequence.csv # use saved copies
//
// It writes nothing and fails unless the stations pass the same checks as the
// database import and every station of every line lies on that line's shape.
// The "Metro stations" workflow runs it together with the import.
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { LINES, STATIONS_DATASET, loadDataset, parseCsv, problemsWith, readCsv, stationsFrom } from './fetch-metro-stations.mjs';

export const SEQUENCE_DATASET = {
  id: 'ds533_atm-composizione-percorsi-linee-metropolitane',
  match: /metrosequenza/i,
  fallback:
    'https://dati.comune.milano.it/dataset/b8eb04e7-4e99-4ba7-9502-c2aecc4f7e11/resource/0555a0ae-9493-46ca-bc3d-65544f4e99b2/download/tpl_metrosequenza.csv'
};
export const OUT = 'public/metro/milan-metro.geojson';

export function routesFrom(text) {
  const { head, rows } = readCsv(text);
  const col = (n) => {
    const i = head.indexOf(n);
    if (i < 0) throw new Error(`The sequence file has no ${n} column (columns: ${head.join(', ')}).`);
    return i;
  };
  const route = col('percorso'), num = col('num'), stop = col('id_ferm');
  const byRoute = new Map();
  for (const r of rows) {
    const list = byRoute.get(r[route].trim()) || [];
    list.push([Number(r[num]), r[stop].trim()]);
    byRoute.set(r[route].trim(), list);
  }
  return [...byRoute].map(([id, list]) => ({ id, stops: list.sort((a, b) => a[0] - b[0]).map((x) => x[1]) }));
}

const r5 = (n) => Math.round(n * 1e5) / 1e5;

// Returns { geojson, problems, byLine }.
export function buildMap(stopRows, routes) {
  const problems = [];
  const stops = new Map(stopRows.map((s) => [s.id, s]));
  const stations = stationsFrom(stopRows);
  problems.push(...problemsWith(stations));

  // Each route's line: the one line all its stops share.
  const lineRoutes = Object.fromEntries(LINES.map((l) => [l, []]));
  for (const r of routes) {
    const missing = r.stops.filter((id) => !stops.has(id));
    if (missing.length) {
      problems.push(`Route ${r.id} has stops that aren't in the stations file: ${missing.join(', ')}.`);
      continue;
    }
    if (r.stops.length < 2) continue;
    const shared = LINES.filter((l) => r.stops.every((id) => stops.get(id).lines.includes(l)));
    if (shared.length !== 1) {
      problems.push(`Route ${r.id} (${r.stops.length} stops) belongs to ${shared.length ? shared.join(' and ') : 'no line'}.`);
      continue;
    }
    lineRoutes[shared[0]].push(r);
  }

  // Longest routes first; each one adds only the segments not drawn yet,
  // as runs of consecutive stops.
  const features = [];
  const byLine = {};
  for (const line of LINES) {
    const done = new Set();
    const onShape = new Set();
    const runs = [];
    for (const r of [...lineRoutes[line]].sort((a, b) => b.stops.length - a.stops.length || a.id.localeCompare(b.id))) {
      let run = null;
      for (let i = 1; i < r.stops.length; i++) {
        const a = r.stops[i - 1], b = r.stops[i];
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (done.has(key)) {
          run = null;
          continue;
        }
        done.add(key);
        if (!run) {
          run = [a];
          runs.push(run);
        }
        run.push(b);
      }
    }
    for (const run of runs) {
      run.forEach((id) => onShape.add(id));
      features.push({
        type: 'Feature',
        properties: { kind: 'line', line },
        geometry: { type: 'LineString', coordinates: run.map((id) => [r5(stops.get(id).lon), r5(stops.get(id).lat)]) }
      });
    }
    byLine[line] = { segments: done.size, pieces: runs.length };
    if (!runs.length) problems.push(`${line} has no route in the sequence file.`);
    const off = stopRows.filter((s) => s.lines.includes(line) && !onShape.has(s.id));
    if (off.length) problems.push(`${line}: ${off.map((s) => s.raw).join(', ')} not on any ${line} route.`);
  }

  for (const s of stations) {
    features.push({
      type: 'Feature',
      properties: { kind: 'station', name: s.name, lines: s.lines.join(' ') },
      geometry: { type: 'Point', coordinates: [r5(s.lon), r5(s.lat)] }
    });
  }
  const geojson = {
    type: 'FeatureCollection',
    attribution: 'Comune di Milano, CC BY 4.0 (datasets DS535 and DS533, dati.comune.milano.it)',
    features
  };
  return { geojson, problems, byLine, stations };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const stopRows = parseCsv(await loadDataset(STATIONS_DATASET, process.argv[2]));
  const routes = routesFrom(await loadDataset(SEQUENCE_DATASET, process.argv[3]));
  const { geojson, problems, byLine, stations } = buildMap(stopRows, routes);
  const lines = LINES.map((l) => `| ${l} | ${byLine[l].segments} | ${byLine[l].pieces} |`);
  const text = [
    '## Metro map (lines and stations)',
    '',
    problems.length
      ? ['**Failed, nothing was written:**', '', ...problems.map((p) => `- ${p}`)].join('\n')
      : `**${stations.length} stations, ${routes.length} routes**, written to \`${OUT}\`.`,
    '',
    '| Line | Segments between stations | Pieces drawn |',
    '| --- | ---: | ---: |',
    ...lines,
    ''
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  }
  console.log(text);
  if (problems.length) process.exit(1);
  mkdirSync('public/metro', { recursive: true });
  writeFileSync(OUT, JSON.stringify(geojson) + '\n');
}
