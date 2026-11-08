#!/usr/bin/env node
// Fetches Milan's metro stations (M1 to M5) from the City of Milan's open data
// and writes a migration that loads them into public.metro_stations.
//
// Source: dataset DS535 "ATM - Fermate linee metropolitane", file
// ds535_tpl_metrofermate.csv, on https://dati.comune.milano.it
// Data: Comune di Milano, CC BY 4.0.
//
// Normally run by the "Metro stations" GitHub Actions workflow
// (.github/workflows/metro-stations.yml), started by hand from the Actions
// tab: it runs this script and pushes the migration to the branch
// data/metro-stations, ready for a pull request. Locally:
//
//   node scripts/fetch-metro-stations.mjs            # download the file
//   node scripts/fetch-metro-stations.mjs file.csv   # use a saved copy
//
// It writes supabase/migrations/<now>_metro_stations_data.sql only when every
// check below passes; otherwise it writes nothing and fails. The counts per
// line and every station are printed (and, in GitHub Actions, put in the
// run's summary) so they can be checked before the pull request is merged.
//
// How: the file has one row per stop. An interchange is either one row with
// several lines ("2,5") or one row per line ("DUOMO M1", "DUOMO M3"): rows
// that get the same name below are one station, with the lines of all its
// rows and the middle of their points.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// The City's catalogue (CKAN) gives each file's current link; the links below
// are used if the catalogue can't be read (they change whenever the city
// uploads a new version of a file).
export const STATIONS_DATASET = {
  id: 'ds535_atm-fermate-linee-metropolitane',
  match: /metrofermate/i,
  fallback:
    'https://dati.comune.milano.it/dataset/b7344a8f-0ef5-424b-a902-f7f06e32dd67/resource/0f4d4d05-b379-45a4-9a10-412a34708484/download/tpl_metrofermate.csv'
};
const HEADERS = { 'User-Agent': 'GigoMe metro import (hello@gigome.org)' };

export const MIN_STATIONS = 115;
export const MAX_STATIONS = 130;
export const MIN_PER_LINE = 15;
export const LINES = ['M1', 'M2', 'M3', 'M4', 'M5'];
// Rows merged into one station must be this close; two different stations
// this close are probably one station under two names.
const SAME_PLACE_M = 300;
const TOO_CLOSE_M = 200;

// Stations that must be there, with these lines, within 300 m of this point.
export const LANDMARKS = [
  { name: 'Duomo', lines: ['M1', 'M3'], at: [45.4642, 9.19] },
  { name: 'Porta Venezia', lines: ['M1'], at: [45.4745, 9.205] },
  { name: 'Garibaldi FS', lines: ['M2', 'M5'], at: [45.484, 9.187] },
  { name: 'Centrale FS', lines: ['M2', 'M3'], at: [45.4848, 9.203] }
];

// Names written out where the file abbreviates them, and the two
// interchanges whose rows have different names. Everything else is the
// file's name in normal capitals, without a trailing " M1" etc.
const NAMES = new Map([
  ['P.TA VENEZIA', 'Porta Venezia'],
  ['P.TA GENOVA F.S.', 'Porta Genova FS'],
  ['S.AMBROGIO', "Sant'Ambrogio"],
  ['SAN AMBROGIO', "Sant'Ambrogio"],
  ['S.AGOSTINO', "Sant'Agostino"],
  ['S.LEONARDO', 'San Leonardo'],
  ['VILLA S.G.', 'Villa San Giovanni'],
  ['CA GRANDA', "Ca' Granda"],
  ['LODI T.I.B.B.', 'Lodi T.I.B.B.'],
  ['SESTO 1 MAGGIO FS', 'Sesto 1° Maggio FS'],
  ['SESTO RONDO', 'Sesto Rondò'],
  ['CASSINA DE PECCHI', "Cassina de' Pecchi"],
  ['LOTTO FIERAMILANOCITY', 'Lotto']
]);
const KEEP_UPPER = new Set(['FS', 'FN', 'QT8']);
const KEEP_LOWER = new Set(['sul', 'di', 'del', 'della', 'de']);

export function displayName(raw) {
  const plain = raw.trim().replace(/\s+/g, ' ').toUpperCase();
  if (NAMES.has(plain)) return NAMES.get(plain);
  const base = plain.replace(/ M[1-5]$/, '');
  if (NAMES.has(base)) return NAMES.get(base);
  return base
    .split(' ')
    .map((word, i) => {
      if (KEEP_UPPER.has(word)) return word;
      if (i > 0 && KEEP_LOWER.has(word.toLowerCase())) return word.toLowerCase();
      return word
        .split('-')
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join('-');
    })
    .join(' ');
}

// The portal is sometimes slow or briefly down (502): three tries, with a
// pause before each retry. A 404 isn't retried.
async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60_000) });
      if (res.ok) return res;
      const err = new Error(`${url} answered ${res.status}`);
      err.final = res.status < 500;
      throw err;
    } catch (e) {
      if (e.final || i >= tries) throw e;
      console.log(`${e.message}; trying again in ${15 * i} s`);
      await new Promise((r) => setTimeout(r, 15000 * i));
    }
  }
}

// Downloads a dataset's CSV (or reads a saved copy).
export async function loadDataset(dataset, file) {
  if (file) return readFileSync(file, 'utf8');
  let url = dataset.fallback;
  try {
    const meta = await (await get(`https://dati.comune.milano.it/api/3/action/package_show?id=${dataset.id}`)).json();
    const csv = meta.result.resources.find((r) => /csv/i.test(r.format) && dataset.match.test(r.url));
    if (csv) url = csv.url;
    else console.log(`No CSV in the catalogue entry for ${dataset.id}, using the known link`);
  } catch (e) {
    console.log(`Couldn't read the catalogue (${e.message}), using the known link`);
  }
  console.log(`Data from ${url}`);
  return (await get(url)).text();
}

// The file: semicolons between fields, double quotes around some of them.
export function readCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  const head = rows.shift().map((h) => h.trim().toLowerCase());
  return { head, rows };
}

export function parseCsv(text) {
  const { head, rows } = readCsv(text);
  const col = (...names) => {
    const i = head.findIndex((h) => names.includes(h));
    if (i < 0) throw new Error(`The file has no ${names.join(' or ')} column (columns: ${head.join(', ')}).`);
    return i;
  };
  const id = col('id_amat', 'id'), name = col('nome', 'ubicazione'), lines = col('linee'), lon = col('long_x_4326'), lat = col('lat_y_4326');
  return rows.map((r) => ({
    id: r[id].trim(),
    raw: r[name].trim(),
    lines: (r[lines].match(/[1-5]/g) || []).map((n) => 'M' + n),
    lat: Number(r[lat]),
    lon: Number(r[lon])
  }));
}

function metres(a, b) {
  return Math.hypot((a[1] - b[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180), (a[0] - b[0]) * 110540);
}
const round = (n) => Math.round(n * 1e6) / 1e6;

export function stationsFrom(rows) {
  const byName = new Map();
  for (const r of rows) {
    const name = displayName(r.raw);
    const s = byName.get(name) || { name, lines: new Set(), pts: [], raws: [] };
    r.lines.forEach((l) => s.lines.add(l));
    s.pts.push([r.lat, r.lon]);
    s.raws.push(r.raw);
    byName.set(name, s);
  }
  return [...byName.values()]
    .map((s) => ({
      name: s.name,
      lines: [...s.lines].sort(),
      lat: round(s.pts.reduce((a, p) => a + p[0], 0) / s.pts.length),
      lon: round(s.pts.reduce((a, p) => a + p[1], 0) / s.pts.length),
      raws: s.raws,
      spread: Math.max(0, ...s.pts.flatMap((p) => s.pts.map((q) => metres(p, q))))
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

export function countByLine(stations) {
  const byLine = Object.fromEntries(LINES.map((l) => [l, 0]));
  for (const s of stations) for (const l of s.lines) byLine[l] += 1;
  return byLine;
}

// Every reason these stations can't be used; none means they can.
export function problemsWith(stations) {
  const problems = [];
  const byLine = countByLine(stations);
  if (stations.length < MIN_STATIONS || stations.length > MAX_STATIONS)
    problems.push(`${stations.length} stations, expected between ${MIN_STATIONS} and ${MAX_STATIONS}.`);
  for (const l of LINES) if (byLine[l] < MIN_PER_LINE) problems.push(`${l} has ${byLine[l]} stations, expected at least ${MIN_PER_LINE}.`);
  for (const s of stations) {
    if (!s.lines.length) problems.push(`${s.name} has no line.`);
    if (!(s.lat >= 45.25 && s.lat <= 45.7 && s.lon >= 8.7 && s.lon <= 9.6)) problems.push(`${s.name} is outside the Milan area (${s.lat}, ${s.lon}).`);
    if (new Set(s.raws).size < s.raws.length) problems.push(`${s.name} is in the file more than once.`);
    if (/\.|^[A-Z0-9' ]+$/.test(s.name.replace('Lodi T.I.B.B.', 'Lodi')) && s.name !== 'QT8')
      problems.push(`"${s.name}" looks abbreviated or unformatted: add how to write it to NAMES in the script.`);
    if (s.spread > SAME_PLACE_M)
      problems.push(`${s.name} joins rows ${Math.round(s.spread)} m apart (${s.raws.join(', ')}): probably two different stations.`);
  }
  const seen = new Map();
  for (const s of stations) {
    const k = s.name.toLowerCase();
    if (seen.has(k)) problems.push(`${s.name} appears twice.`);
    seen.set(k, s);
  }
  for (let i = 0; i < stations.length; i++)
    for (let j = i + 1; j < stations.length; j++) {
      const m = metres([stations[i].lat, stations[i].lon], [stations[j].lat, stations[j].lon]);
      if (m < TOO_CLOSE_M) problems.push(`${stations[i].name} and ${stations[j].name} are ${Math.round(m)} m apart: probably one station under two names.`);
    }
  for (const want of LANDMARKS) {
    const s = stations.find((x) => x.name === want.name);
    if (!s) problems.push(`${want.name} is missing.`);
    else {
      if (s.lines.join() !== want.lines.join()) problems.push(`${want.name} has ${s.lines.join(', ')}, expected ${want.lines.join(', ')}.`);
      const m = metres([s.lat, s.lon], want.at);
      if (m > 300) problems.push(`${want.name} is ${Math.round(m)} m from where it should be.`);
    }
  }
  return problems;
}

// Markdown for the GitHub Actions run summary (also printed).
export function summary(stations, problems, file) {
  const byLine = countByLine(stations);
  const cell = (s) => s.replace(/\|/g, '\\|');
  const merged = stations.filter((s) => s.raws.length > 1);
  return [
    '## Metro stations from the City of Milan (DS535)',
    '',
    problems.length
      ? ['**Failed, nothing was written:**', '', ...problems.map((p) => `- ${p}`)].join('\n')
      : `**${stations.length} stations**, written to \`${file}\`. All checks passed.`,
    '',
    '| Line | Stations |',
    '| --- | ---: |',
    ...LINES.map((l) => `| ${l} | ${byLine[l]} |`),
    `| **All lines** (a station on two lines counts once) | **${stations.length}** |`,
    '',
    'Interchanges listed once per line in the file, joined into one station:',
    '',
    ...merged.map((s) => `- ${s.name} (${s.lines.join(', ')}): ${s.raws.join(' + ')}, ${Math.round(s.spread)} m apart`),
    '',
    '<details><summary>Every station</summary>',
    '',
    '| Station | Lines | In the file as |',
    '| --- | --- | --- |',
    ...stations.map((s) => `| ${cell(s.name)} | ${s.lines.join(', ')} | ${cell(s.raws.join(' + '))} |`),
    '',
    '</details>',
    ''
  ].join('\n');
}

const q = (s) => "'" + s.replace(/'/g, "''") + "'";

export function toSql(stations, when) {
  const rows = stations.map((s) => `  (${q(s.name)}, array[${s.lines.map(q).join(', ')}], ${s.lat}, ${s.lon})`);
  return `-- Milan metro stations (M1 to M5), generated by scripts/fetch-metro-stations.mjs
-- on ${when} from the City of Milan's open data: dataset DS535
-- "ATM - Fermate linee metropolitane" (ds535_tpl_metrofermate.csv),
-- https://dati.comune.milano.it
-- Data: Comune di Milano, CC BY 4.0.
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
  const stations = stationsFrom(parseCsv(await loadDataset(STATIONS_DATASET, process.argv[2])));
  const problems = problemsWith(stations);
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const file = `supabase/migrations/${stamp}_metro_stations_data.sql`;
  if (!problems.length) writeFileSync(file, toSql(stations, now.toISOString().slice(0, 10)));
  const text = summary(stations, problems, file);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  console.log(text);
  if (problems.length) process.exit(1);
}
