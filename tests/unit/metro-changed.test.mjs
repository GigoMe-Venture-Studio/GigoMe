// node --test tests/unit
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { previousMigration, sameStations, stripHeader } from '../../scripts/metro-changed.mjs';

const body = "insert into public.metro_stations (name, lines, latitude, longitude) values\n  ('Duomo', array['M1','M3'], 45.464, 9.189);\n";
const withDate = (d) => `-- Milan metro stations, generated\n-- on ${d} from the City of Milan's open data\n--\n-- Adds or updates the stations.\n\n${body}`;

test('only the date in the header differs: unchanged', () => {
  assert.ok(sameStations(withDate('2026-11-08'), withDate('2026-11-09')));
  assert.equal(stripHeader(withDate('2026-11-08')), body.trimEnd());
});

test('a station that moved, appeared or changed lines: changed', () => {
  assert.ok(!sameStations(withDate('2026-11-08'), withDate('2026-11-09').replace('9.189', '9.190')));
  assert.ok(!sameStations(withDate('2026-11-08'), withDate('2026-11-09').replace("'M1','M3'", "'M1'")));
  assert.ok(!sameStations(withDate('2026-11-08'), withDate('2026-11-09') + "  ('New', array['M6'], 45.5, 9.2);\n"));
});

test('a comment further down still counts (only the top block is ignored)', () => {
  assert.ok(!sameStations(withDate('2026-11-08'), withDate('2026-11-08') + '-- note\n'));
});

test('compares with the newest earlier station migration', () => {
  const files = ['20261108170100_metro_categories.sql', '20261101000000_metro_stations_data.sql', '20261108180152_metro_stations_data.sql', '20261109104803_metro_stations_data.sql'];
  assert.equal(previousMigration(files, 'supabase/migrations/20261109104803_metro_stations_data.sql'), '20261108180152_metro_stations_data.sql');
  assert.equal(previousMigration(['20261109104803_metro_stations_data.sql'], 'supabase/migrations/20261109104803_metro_stations_data.sql'), null);
});
