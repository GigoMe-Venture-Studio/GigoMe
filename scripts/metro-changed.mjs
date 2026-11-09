// Did the Metro stations workflow produce anything new? Compares the station
// migration it just generated with the newest one already in
// supabase/migrations, ignoring the comment block at the top (which holds the
// date it was generated). Used by .github/workflows/metro-stations.yml:
//
//   node scripts/metro-changed.mjs <new-migration-file>
//
// Prints what it found and, on GitHub, writes `changed=true|false` to
// $GITHUB_OUTPUT. The map file (public/metro/milan-metro.geojson) is compared
// by the workflow itself with git.
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = 'supabase/migrations';
const PATTERN = /^\d{14}_metro_stations_data\.sql$/;

// The SQL without the leading comment lines and blank lines.
export function stripHeader(sql) {
  const lines = String(sql).replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length && (lines[i].trim() === '' || lines[i].trimStart().startsWith('--'))) i++;
  return lines.slice(i).join('\n').trimEnd();
}

export function sameStations(previousSql, newSql) {
  return stripHeader(previousSql) === stripHeader(newSql);
}

// The newest station migration other than the new one, or null.
export function previousMigration(files, newFile) {
  const name = basename(newFile);
  const older = files.filter((f) => PATTERN.test(f) && f !== name).sort();
  return older.length ? older[older.length - 1] : null;
}

function main(newFile) {
  if (!newFile) {
    console.error('usage: node scripts/metro-changed.mjs <new-migration-file>');
    process.exit(2);
  }
  const previous = previousMigration(readdirSync(DIR), newFile);
  const changed = !previous || !sameStations(readFileSync(join(DIR, previous), 'utf8'), readFileSync(newFile, 'utf8'));
  console.log(
    previous
      ? `${changed ? 'Stations changed' : 'Stations unchanged'} compared with ${previous}.`
      : 'No earlier station migration: this is the first.'
  );
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv[2]);
