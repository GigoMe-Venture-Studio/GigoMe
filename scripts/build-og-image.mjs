// Rebuilds public/og-image.png, the link preview image (1200x630): the logo
// and the home page headline on a white card framed in the brand purple.
// Change TAGLINE when the home page headline changes, then run
//
//   node scripts/build-og-image.mjs
//
// after `npm install` (it uses the self-hosted font from node_modules) with
// Playwright available (`npm install --no-save playwright`, as in CI).
// Keep og:image:alt in index.html in step with the line.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Through require(), so a Playwright installed globally is found too.
const { chromium } = createRequire(import.meta.url)('playwright');

const TAGLINE = ['Part-time jobs and gigs', 'in Milan, in English.'];

const root = new URL('../', import.meta.url);
const dataUri = (path, type) => `data:${type};base64,${readFileSync(new URL(path, root)).toString('base64')}`;
const font = dataUri('node_modules/@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2', 'font/woff2');
const logo = dataUri('public/brand/logo-wordmark.png', 'image/png');
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Schibsted Grotesk'; src: url(${font}) format('woff2'); font-weight: 400 900; }
html, body { margin: 0; width: 1200px; height: 630px; background: #A46BD6; }
.card { position: absolute; left: 72px; top: 72px; width: 1056px; height: 486px; background: #fff; border-radius: 32px; }
.logo { position: absolute; left: 330px; top: 174px; width: 538px; }
.line { position: absolute; left: 0; width: 1200px; text-align: center; font: 700 46.3px/1 'Schibsted Grotesk', sans-serif;
        color: #1D1B2E; letter-spacing: -0.2px; }
</style></head><body>
<div class="card"></div>
<img class="logo" src="${logo}" alt="">
<div class="line" style="top: 347px">${escape(TAGLINE[0])}</div>
<div class="line" style="top: 404px">${escape(TAGLINE[1])}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: 'png' });
await browser.close();
writeFileSync(new URL('public/og-image.png', root), png);
console.log(`public/og-image.png: ${png.length} bytes`);
