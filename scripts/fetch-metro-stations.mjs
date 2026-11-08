#!/usr/bin/env node
// Fetches Milan's metro stations (M1–M5) from OpenStreetMap and writes a
// migration that loads them into public.metro_stations.
//
// Normally run by the "Metro stations" GitHub Actions workflow
// (.github/workflows/metro-stations.yml), started by hand from the Actions
// tab: it runs this script and pushes the migration to the branch
// data/metro-stations, ready for a pull request. Locally:
//
//   node scripts/fetch-metro-stations.mjs            # fetch from Overpass
//   node scripts/fetch-metro-stations.mjs data.json  # use a saved Overpass answer
//
// It writes supabase/migrations/<now>_metro_stations_data.sql, but only when
// it finds between 100 and 130 stations and every line M1 to M5 has some;
// otherwise it writes nothing and fails. The counts (and, in GitHub Actions,
// the full list of stations) are printed so they can be checked before the
// pull request is merged. Merging it loads the stations and recomputes every
// job's nearest station.
//
// Data © OpenStreetMap contributors, available under the Open Database
// License (ODbL): https://www.openstreetmap.org/copyright
//
// How: the M1–M5 route relations in OpenStreetMap list their stops (one stop
// position per track). Stops with the same name are one station: its lines
// are the routes that stop there, its point is the middle of its stops.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const MIN_STATIONS = 100;
export const MAX_STATIONS = 130;
export const LINES = ['M1', 'M2', 'M3', 'M4', 'M5'];

// Public Overpass servers, tried in this order until one answers.
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const QUERY = `[out:json][timeout:90];
rel["route"="subway"]["ref"~"^M[1-5]$"](45.25,8.70,45.70,9.60)->.routes;
.routes out body;
node(r.routes)->.nodes;
.nodes out body;`;

// Different spellings of the same station name, if any turn up.
const SAME = new Map([]);

async function load(file) {
  if (file) return JSON.parse(readFileSync(file, 'utf8'));
  const problems = [];
  for (const url of SERVERS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'GigoMe metro import (hello@gigome.org)' },
        body: 'data=' + encodeURIComponent(QUERY),
        signal: AbortSignal.timeout(120_000)
      });
      if (!res.ok) throw new Error(`answered ${res.status}`);
      const data = await res.json();
      // A query that ran out of time or memory still answers 200, with a remark.
      if (data.remark) throw new Error(`remark: ${data.remark}`);
      console.log(`Data from ${url}`);
      return data;
    } catch (e) {
      problems.push(`${url}: ${e.message}`);
      console.log(`${url} failed (${e.message}), trying the next server`);
    }
  }
  throw new Error('No Overpass server answered:\n' + problems.join('\n'));
}

export function countByLine(stations) {
  const byLine = Object.fromEntries(LINES.map((l) => [l, 0]));
  for (const s of stations) for (const l of s.lines) byLine[l] += 1;
  return byLine;
}

// Why these stations can't be used, or '' when they can.
export function problemWith(stations) {
  const byLine = countByLine(stations);
  const empty = LINES.filter((l) => byLine[l] === 0);
  if (stations.length < MIN_STATIONS || stations.length > MAX_STATIONS)
    return `${stations.length} stations found, expected between ${MIN_STATIONS} and ${MAX_STATIONS}.`;
  if (empty.length) return `No stations found for ${empty.join(', ')}.`;
  return '';
}

// Markdown for the GitHub Actions run summary.
export function summary(stations, problem, file) {
  const byLine = countByLine(stations);
  const list = stations.map((s) => `| ${s.name.replace(/\|/g, '\\|')} | ${s.lines.join(', ')} |`);
  return [
    '## Metro stations from OpenStreetMap',
    '',
    problem ? `**Failed:** ${problem} Nothing was written.` : `**${stations.length} stations**, written to \`${file}\`.`,
    '',
    '| Line | Stations |',
    '| --- | ---: |',
    ...LINES.map((l) => `| ${l} | ${byLine[l]} |`),
    `| **All lines** (a station on two lines counts once) | **${stations.length}** |`,
    '',
    '<details><summary>Every station</summary>',
    '',
    '| Station | Lines |',
    '| --- | --- |',
    ...list,
    '',
    '</details>',
    ''
  ].join('\n');
}

export function stationsFrom(data) {
  const nodes = new Map(data.elements.filter((e) => e.type === 'node').map((n) => [n.id, n]));
  const stations = new Map();
  for (const rel of data.elements.filter((e) => e.type === 'relation')) {
    const line = rel.tags && rel.tags.ref;
    if (!/^M[1-5]$/.test(line || '')) continue;
    for (const m of rel.members || []) {
      if (m.type !== 'node' || !/^(stop|stop_entry_only|stop_exit_only)$/.test(m.role)) continue;
      const n = nodes.get(m.ref);
      const raw = n && n.tags && (n.tags.name || n.tags['name:it']);
      if (!raw) continue;
      const name = SAME.get(raw.trim()) || raw.trim().replace(/\s+/g, ' ');
      const s = stations.get(name) || { name, lines: new Set(), pts: [] };
      s.lines.add(line);
      s.pts.push([n.lat, n.lon]);
      stations.set(name, s);
    }
  }
  return [...stations.values()]
    .map((s) => ({
      name: s.name,
      lines: [...s.lines].sort(),
      lat: round(s.pts.reduce((a, p) => a + p[0], 0) / s.pts.length),
      lon: round(s.pts.reduce((a, p) => a + p[1], 0) / s.pts.length)
    }))
    .filter((s) => s.lat >= 45.25 && s.lat <= 45.7 && s.lon >= 8.7 && s.lon <= 9.6)
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

function round(n) {
  return Math.round(n * 1e6) / 1e6;
}

const q = (s) => "'" + s.replace(/'/g, "''") + "'";

export function toSql(stations, when) {
  const rows = stations.map((s) => `  (${q(s.name)}, array[${s.lines.map(q).join(', ')}], ${s.lat}, ${s.lon})`);
  return `-- Milan metro stations (M1–M5), generated by scripts/fetch-metro-stations.mjs
-- on ${when} from OpenStreetMap.
-- Data © OpenStreetMap contributors, Open Database License (ODbL):
-- https://www.openstreetmap.org/copyright
--
-- Adds or updates the ${stations.length} stations by name, then recomputes the nearest
-- station of every job with an exact location (the job_nearest_station trigger
-- runs when the location columns are touched).

insert into public.metro_stations (name, lines, latitude, longitude) values
${rows.join(',\n')}
on conflict (name) do update
  set lines = excluded.lines, latitude = excluded.latitude, longitude = excluded.longitude;

update public.jobs set latitude = latitude where latitude is not null;
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = await load(process.argv[2]);
  const stations = stationsFrom(data);
  const problem = problemWith(stations);
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const file = `supabase/migrations/${stamp}_metro_stations_data.sql`;
  if (!problem) writeFileSync(file, toSql(stations, now.toISOString().slice(0, 10)));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(stations, problem, file));
  for (const [line, n] of Object.entries(countByLine(stations))) console.log(`${line}: ${n} stations`);
  if (problem) {
    console.error(`Failed: ${problem} Nothing was written.`);
    process.exit(1);
  }
  console.log(`Wrote ${file}: ${stations.length} stations`);
}
