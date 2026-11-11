// node --test tests/unit
// /privacy and /terms must show the supplied legal texts word for word
// (docs/legal/published/*.html), with only the drafting notes
// "(activate this link before publication)" removed. These checks strip the
// supplied page on their own, without the converter, and compare.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { legalToJson } from '../../scripts/legal-to-json.mjs';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const DOCS = [
  ['docs/legal/published/privacy-notice-v1.0.html', 'src/legal/privacy.json', 'GigoMe | Privacy Notice'],
  ['docs/legal/published/terms-and-conditions-v2.0.html', 'src/legal/terms.json', 'GigoMe | Terms and Conditions']
];
const NOTE = '(activate this link before publication)';

// The words of the supplied text: what's inside <main>, every tag a space.
function sourceWords(html) {
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const text = main.slice(main.indexOf('>') + 1).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&');
  assert.ok(!/&[a-z#0-9]+;/i.test(text), 'only &amp; is expected in these files');
  return text.split(NOTE).join(' ').split(/\s+/).filter(Boolean);
}
// The words of the JSON: every element boundary a space.
const jsonText = (n) => (typeof n === 'string' ? n : ' ' + n.slice(2).map(jsonText).join(' ') + ' ');
const jsonWords = (doc) => doc.body.map(jsonText).join(' ').split(/\s+/).filter(Boolean);
const ids = (s) => [...s.matchAll(/id="(section-\d+)"/g)].map((m) => m[1]);

for (const [html, json, title] of DOCS) {
  const source = read(html);
  const doc = JSON.parse(read(json));

  test(`${json} is up to date with ${html}`, () => {
    assert.deepEqual(doc, legalToJson(source, html).json, `run: node scripts/legal-to-json.mjs ${html} ${json}`);
  });

  test(`${json}: the supplied wording, word for word`, () => {
    const want = sourceWords(source), got = jsonWords(doc);
    const i = want.findIndex((w, k) => w !== got[k]);
    assert.equal(i === -1 && want.length === got.length, true, `first difference at word ${i}: ${JSON.stringify(want.slice(i - 3, i + 4))} vs ${JSON.stringify(got.slice(i - 3, i + 4))}`);
    assert.equal(doc.title, title);
  });

  test(`${json}: every section anchor kept, drafting notes gone`, () => {
    const main = source.slice(source.indexOf('<main'), source.indexOf('</main>'));
    assert.deepEqual(ids(JSON.stringify(doc.body).replace(/"id":"/g, 'id="').replace(/"\}/g, '"}')), ids(main));
    assert.equal(source.split(NOTE).length - 1, 1, 'the supplied text has one drafting note');
    assert.ok(!JSON.stringify(doc).includes('activate this link'));
    assert.ok(doc.toc.length > 10 && doc.toc.every((t) => ids(main).includes(t.href.slice(1))), 'the contents list points to real sections');
  });
}

test('the two texts link to each other', () => {
  const links = (doc) => JSON.stringify(doc.body).match(/"href":"[^"]+"/g);
  assert.ok(links(JSON.parse(read('src/legal/privacy.json'))).includes('"href":"https://gigome.org/terms"'));
  assert.ok(links(JSON.parse(read('src/legal/terms.json'))).includes('"href":"https://gigome.org/privacy"'));
});

test('the converter refuses markup it does not know', () => {
  assert.throws(() => legalToJson('<main><script>alert(1)</script></main>', 'x'), /isn't allowed/);
  assert.throws(() => legalToJson('<main><p><a href="javascript:alert(1)">x</a></p></main>', 'x'), /not allowed/);
  assert.throws(() => legalToJson('<main><p onclick="x">a</div></main>', 'x'), /closes/);
});
