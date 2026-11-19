// The login code email template (docs/email/login-code.md, "The template to
// paste"): one subject and one body that pick the language saved with the
// account ({{ .Data.language }}), "it", "en", or both languages for anything
// else. Each version must have the code, and the same words as the English,
// Italian and combined versions it is built from.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const doc = readFileSync(new URL('../../docs/email/login-code.md', import.meta.url), 'utf8');
// The fenced block under a heading.
function block(heading) {
  const at = doc.indexOf(`\n${heading}\n`);
  assert.ok(at >= 0, `heading ${heading}`);
  const m = doc.slice(at).match(/```(?:html)?\n([\s\S]*?)\n```/);
  return m[1];
}
const paste = doc.slice(doc.indexOf('## The template to paste'), doc.indexOf('## The three versions'));
const pasteBlock = (h) => {
  const at = paste.indexOf(`\n${h}\n`);
  assert.ok(at >= 0, `heading ${h} in "The template to paste"`);
  return paste.slice(at).match(/```(?:html)?\n([\s\S]*?)\n```/)[1];
};
const subject = pasteBlock('### Subject');
const body = pasteBlock('### HTML');

// The three branches of a template: [it, en, both].
function branches(src) {
  const m = src.match(/^([\s\S]*?)\{\{ if eq \$lang "it" \}\}([\s\S]*?)\{\{ else if eq \$lang "en" \}\}([\s\S]*?)\{\{ else \}\}([\s\S]*?)\{\{ end \}\}([\s\S]*)$/);
  assert.ok(m, 'if "it" / else if "en" / else / end, in that order');
  assert.ok(m[1].includes('{{ $lang := printf "%v" .Data.language }}'), 'the language is read as text first (so no value can break the email)');
  return { before: m[1], it: m[2], en: m[3], both: m[4], after: m[5] };
}
// The <p> lines of an HTML version, without its frame and signature.
const lines = (html) => html.split('\n').map((l) => l.trim()).filter((l) => l && !/^<\/?div|^\{\{|^<p style="margin: 0;">GigoMe<\/p>$/.test(l));

test('the subject: Italian, English, or both, with the code in each', () => {
  const b = branches(subject);
  assert.equal(b.it, block('### Italian: subject'));
  assert.equal(b.en, block('### English: subject'));
  assert.equal(b.both, block('### English and Italian: subject'));
  assert.ok(!subject.includes('\n'), 'one line');
});

test('the body: Italian, English, or both, the same words as the three versions', () => {
  const b = branches(body);
  assert.deepEqual(lines(b.it), lines(block('### Italian: HTML')));
  assert.deepEqual(lines(b.en), lines(block('### English: HTML')));
  assert.deepEqual(lines(b.both), lines(block('### English and Italian: HTML')));
  for (const [name, part] of Object.entries({ it: b.it, en: b.en, both: b.both })) {
    assert.equal(part.split('{{ .Token }}').length - 1, 1, `the code once in the ${name} version`);
  }
  assert.ok(b.after.includes('<p style="margin: 0;">GigoMe</p>'), 'signed GigoMe in every version');
});

test('no links or images in the email (docs/email/login-code.md, "Rules")', () => {
  assert.ok(!/<a\s|<img\s|https?:\/\//i.test(subject + body));
});
