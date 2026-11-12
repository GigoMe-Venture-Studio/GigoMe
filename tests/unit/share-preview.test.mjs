// node --test tests/unit
// What WhatsApp, Instagram and other apps read when gigome.org is shared:
// the tags in index.html and the image they point to.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const meta = (attr, name) => {
  const m = html.match(new RegExp(`<meta ${attr}="${name.replace(/[:.]/g, '\\$&')}" content="([^"]*)">`));
  return m ? m[1] : null;
};

test('the share image is a 1200x630 PNG, small enough for WhatsApp', () => {
  const png = readFileSync(new URL('public/og-image.png', root));
  assert.equal(png.subarray(1, 4).toString('latin1'), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200, 'width');
  assert.equal(png.readUInt32BE(20), 630, 'height');
  assert.ok(png.length < 300 * 1024, `under 300 KB: ${png.length} bytes`);
  assert.equal(meta('property', 'og:image'), 'https://gigome.org/og-image.png');
  assert.equal(meta('property', 'og:image:width'), '1200');
  assert.equal(meta('property', 'og:image:height'), '630');
});

test('the image has a real description, for Open Graph and X', () => {
  const alt = meta('property', 'og:image:alt');
  assert.ok(alt && alt.length > 20 && alt !== 'GigoMe', 'og:image:alt describes the image: ' + alt);
  assert.equal(meta('name', 'twitter:image:alt'), alt);
});

test('theme-color is set', () => {
  assert.match(meta('name', 'theme-color') || '', /^#[0-9A-Fa-f]{6}$/);
});

test('the image line, its description and the home page headline say the same', () => {
  const line = 'Part-time jobs and gigs in Milan, in English.';
  const script = readFileSync(new URL('scripts/build-og-image.mjs', root), 'utf8');
  const tagline = JSON.parse(script.match(/const TAGLINE = (\[.*\]);/)[1].replace(/'/g, '"')).join(' ');
  assert.equal(tagline, line, 'scripts/build-og-image.mjs TAGLINE');
  assert.equal(meta('property', 'og:image:alt'), 'The GigoMe logo with the line: ' + line);
  const home = readFileSync(new URL('src/pages/Home.jsx', root), 'utf8');
  assert.ok(home.includes(`<h1 id="home-title">${line}</h1>`), 'home page headline');
  assert.doesNotMatch(html, /internship|unpaid/i, 'index.html never mentions internships');
});
