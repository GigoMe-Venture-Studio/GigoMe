// node --test tests/unit
// The Worker's fetch() only runs for requests that match no file and aren't
// page loads. A missing build file under /assets/ must be a real 404 that
// isn't cached; anything else goes back to the static assets.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../../worker/index.js';

const env = { ASSETS: { fetch: async (req) => new Response('from assets ' + new URL(req.url).pathname) } };

test('a missing file under /assets/ is a 404 that browsers don\'t keep', async () => {
  for (const path of ['/assets/index-OLD123.js', '/assets/', '/assets/sub/x.css']) {
    const res = await worker.fetch(new Request('https://gigome.org' + path), env);
    assert.equal(res.status, 404, path);
    assert.equal(res.headers.get('cache-control'), 'no-store', path);
    assert.match(res.headers.get('content-type'), /^text\/plain/, path);
  }
});

test('anything else goes to the static assets as before', async () => {
  for (const path of ['/jobs/123', '/missing.png', '/assetsx/a.js']) {
    const res = await worker.fetch(new Request('https://gigome.org' + path), env);
    assert.equal(await res.text(), 'from assets ' + path, path);
  }
});
