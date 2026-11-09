// A tiny static server for the browser tests: serves a build folder the way
// Cloudflare does for this site (files, then index.html for any other path)
// and applies the folder's _headers rules, so the tests run with the real
// Content-Security-Policy and other security headers.
//
//   node tests/e2e/serve.mjs <build-folder> <port>
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const [dir, port] = process.argv.slice(2);
if (!dir || !port) {
  console.error('usage: node tests/e2e/serve.mjs <build-folder> <port>');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.geojson': 'application/geo+json', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain',
  '.xml': 'application/xml'
};

// _headers: a path pattern line, then indented "Name: value" lines; "! Name"
// removes a header set by an earlier matching rule.
function readRules() {
  const file = join(dir, '_headers');
  if (!existsSync(file)) return [];
  const rules = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const re = new RegExp('^' + line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      rules.push({ re, ops: [] });
    } else if (line.trim().startsWith('!')) {
      rules.at(-1).ops.push({ remove: line.trim().slice(1).trim().toLowerCase() });
    } else {
      const i = line.indexOf(':');
      rules.at(-1).ops.push({ name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() });
    }
  }
  return rules;
}
const rules = readRules();

function headersFor(path) {
  const out = new Map();
  for (const r of rules) {
    if (!r.re.test(path)) continue;
    for (const op of r.ops) {
      if (op.remove) out.delete(op.remove);
      else out.set(op.name.toLowerCase(), [op.name, op.value]);
    }
  }
  return Object.fromEntries([...out.values()]);
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(dir, path));
  if (!file.startsWith(normalize(dir)) || !existsSync(file) || statSync(file).isDirectory()) {
    const index = join(file, 'index.html');
    file = existsSync(index) && file.startsWith(normalize(dir)) ? index : join(dir, 'index.html');
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', ...headersFor(path) });
  res.end(readFileSync(file));
}).listen(Number(port), '127.0.0.1');
