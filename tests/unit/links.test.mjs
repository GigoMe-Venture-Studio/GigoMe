// node --test tests/unit
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPlainEmail, mailtoHref, normalizeUrl, safeHttpUrl, safeNext } from '../../src/lib/links.js';

test('safeNext keeps paths on this site', () => {
  for (const ok of ['/', '/jobs/123', '/jobs?q=barista&when=weekends', '/account#delete', '/companies/abc?x=%2F%2F'])
    assert.equal(safeNext(ok), ok, ok);
});

test('safeNext refuses everything that could leave the site', () => {
  for (const bad of [
    '', null, undefined, 'jobs', 'https://evil.example', 'http:/evil.example', '//evil.example', '///evil.example',
    '/\\evil.example', '/\\/evil.example', '\\\\evil.example', '/\t/evil.example', '/\n/evil.example', '/%0a',
    'javascript:alert(1)', ' /jobs', 'data:text/html,x', '/' + 'a'.repeat(1001)
  ]) {
    const out = safeNext(bad);
    assert.ok(out === '' || (out.startsWith('/') && !out.startsWith('//')), String(bad));
    if (bad !== '/%0a') assert.equal(out, '', String(bad));
  }
});

test('safeHttpUrl: http(s) only, no quotes, spaces or brackets', () => {
  for (const ok of ['https://example.it', 'http://jobs.example.com/apply?id=1#x', 'https://a-b.example.co.uk:8443/x'])
    assert.equal(safeHttpUrl(ok), ok);
  for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,<b>', 'mailto:a@b.it', 'ftp://example.it',
    'https://localhost', 'https://example.it/"onmouseover="x', 'https://example.it/<script>', 'https://ex ample.it',
    'https://user:pass@example.it', '//example.it', 'example.it', ''])
    assert.equal(safeHttpUrl(bad), null, bad);
});

test('normalizeUrl adds https:// and refuses other schemes', () => {
  assert.equal(normalizeUrl('www.example.it/jobs'), 'https://www.example.it/jobs');
  assert.equal(normalizeUrl('  '), '');
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUrl('data:text/html,x'), null);
  assert.equal(normalizeUrl('example'), null);
  assert.equal(normalizeUrl('https://exa mple.it'), null);
  assert.equal(normalizeUrl('café.it'), 'https://xn--caf-dma.it/');
});

test('emails: plain addresses only in mailto links', () => {
  assert.ok(isPlainEmail("o'brien+jobs@example.co.uk"));
  for (const bad of ['jobs@example.it?bcc=x@y.it', 'a"b@example.it', 'a b@example.it', 'jobs@example', 'jobs@example.it&subject=x', '<a@b.it>'])
    assert.equal(isPlainEmail(bad), false, bad);
  assert.equal(mailtoHref('jobs@example.it', 'Application: Barista & more (via GigoMe)'),
    'mailto:jobs@example.it?subject=Application%3A%20Barista%20%26%20more%20(via%20GigoMe)');
  assert.equal(mailtoHref('jobs@example.it?bcc=x@y.it', 'x'), null);
});
