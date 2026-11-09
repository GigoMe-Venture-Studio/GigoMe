// Stand-ins for OpenFreeMap and Nominatim, so tests don't depend on them.
const STYLE = { version: 8, sources: {}, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eef0f4' } }] };
async function stubMap(ctx, log = {}) {
  log.tiles = 0; log.nominatim = [];
  await ctx.route('https://tiles.openfreemap.org/**', (r) => { log.tiles++; return r.request().url().includes('/styles/') ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(STYLE) }) : r.fulfill({ status: 404, body: '' }); });
  await ctx.route('https://nominatim.openstreetmap.org/**', (r) => { const u = new URL(r.request().url()); log.nominatim.push(Object.fromEntries(u.searchParams)); log.nominatimReferer = r.request().headers()['referer'];
    const q = u.searchParams.get('q') || ''; return r.fulfill({ contentType: 'application/json', body: JSON.stringify(/nowhere/i.test(q) ? [] : [{ lat: '45.47801', lon: '9.20555', display_name: 'Via Lazzaretto, Milano' }]) }); });
  return log;
}
module.exports = { stubMap };
