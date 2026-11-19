// The Italian courtesy translations of the legal texts (src/legal/*.it.json,
// shown on /privacy and /terms when the site is in Italian) must have exactly
// the shape of the English JSON: the same elements in the same order, the
// same section ids, the same links and the same "On this page" anchors. Only
// the words differ. The English text stays the one that counts (the page
// says so above the Italian text).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

// Every element as "tag#id[href]", every text as "·", in document order.
const shape = (n) => (typeof n === 'string' ? '·' : `${n[0]}${n[1] && n[1].id ? '#' + n[1].id : ''}${n[1] && n[1].href ? '[' + n[1].href + ']' : ''}(${n.slice(2).map(shape).join(',')})`);
const texts = (n) => (typeof n === 'string' ? [n] : n.slice(2).flatMap(texts));

for (const name of ['privacy', 'terms']) {
  const en = read(`src/legal/${name}.json`);
  const it = read(`src/legal/${name}.it.json`);

  test(`${name}.it.json has the same structure, ids and links as ${name}.json`, () => {
    assert.equal(it.source, en.source);
    assert.deepEqual(it.toc.map((x) => [x.href, x.sub]), en.toc.map((x) => [x.href, x.sub]));
    assert.equal(it.body.length, en.body.length, 'same number of top-level blocks');
    en.body.forEach((n, i) => assert.equal(shape(it.body[i]), shape(n), `block ${i}`));
  });

  test(`${name}.it.json is translated: no block left empty or in English`, () => {
    assert.ok(it.title && it.title !== en.title);
    it.toc.forEach((x, i) => assert.ok(x.label.trim() && x.label !== en.toc[i].label || /^\d+\.\s*$/.test(x.label), `toc ${x.href}`));
    const enTexts = en.body.flatMap(texts), itTexts = it.body.flatMap(texts);
    assert.equal(itTexts.length, enTexts.length);
    // Long English sentences copied unchanged mean a block wasn't translated
    // (short ones can be the same: names, addresses, "GigoMe").
    // Names already in Italian in the English text stay as they are.
    const KEEP = new Set(['Garante per la protezione dei dati personali']);
    const same = enTexts.filter((s, i) => s.trim().split(/\s+/).length > 6 && s === itTexts[i] && !KEEP.has(s.trim()));
    assert.deepEqual(same, []);
  });
}
