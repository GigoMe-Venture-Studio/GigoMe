// Turns a legal text supplied as a web page (docs/legal/published/*.html)
// into the JSON the site renders on /privacy or /terms (src/legal/*.json),
// so the wording on the site is exactly the supplied wording, with our own
// layout instead of the file's header, menu and styles.
//
//   node scripts/legal-to-json.mjs <in.html> <out.json>
//
// Only the document itself is kept: the <main> element (the text) and the
// "On this page" list from the <aside>. Section ids stay as they are, so
// links like /privacy#section-10 keep working. Every tag must be one of
// ALLOWED, and a link must be http(s), mailto or an anchor, otherwise the
// script stops: a new version with new markup has to be looked at, not
// silently mangled. The site renders the JSON with React elements
// (src/components/LegalDocument.jsx), never as HTML.
//
// One change to the wording, on purpose: the drafting notes
// "(activate this link before publication)" are removed. The script prints
// how many it removed.
import { readFileSync, writeFileSync } from 'node:fs';

const ALLOWED = new Set(['h1', 'h2', 'h3', 'p', 'strong', 'em', 'br', 'a', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'hr']);
const VOID = new Set(['br', 'hr', 'meta', 'link', 'img', 'input']);
// Where whitespace between tags means nothing (it's only line breaks in the file).
const BLOCK = new Set(['main', 'ul', 'ol', 'table', 'thead', 'tbody', 'tr', 'blockquote']);
const DRAFT_NOTE = /\s*\(activate this link before publication\)/g;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    if (!(e.toLowerCase() in ENTITIES)) throw new Error('Unknown entity ' + m);
    return ENTITIES[e.toLowerCase()];
  });
}

function attrs(raw) {
  const out = {};
  for (const m of raw.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) out[m[1].toLowerCase()] = decode(m[2]);
  return out;
}

// A small, strict parser: good for these generated files, not for any HTML.
export function parse(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z0-9]+)([^>]*?)(\/?)>|[^<]+/g)) {
    if (m[0].startsWith('<!--')) continue;
    if (m[2]) {
      const tag = m[2].toLowerCase();
      if (m[1]) {
        const top = stack.pop();
        if (top.tag !== tag) throw new Error(`</${tag}> closes <${top.tag}>`);
      } else {
        const node = { tag, attrs: attrs(m[3]), children: [] };
        stack[stack.length - 1].children.push(node);
        if (!VOID.has(tag) && !m[4]) stack.push(node);
      }
    } else {
      stack[stack.length - 1].children.push(decode(m[0]));
    }
  }
  if (stack.length !== 1) throw new Error('Unclosed <' + stack[stack.length - 1].tag + '>');
  return root;
}

function find(node, test) {
  if (typeof node === 'string') return null;
  if (test(node)) return node;
  for (const c of node.children) {
    const hit = find(c, test);
    if (hit) return hit;
  }
  return null;
}

export const textOf = (node) => (typeof node === 'string' ? node : node.children.map(textOf).join(''));

function safeHref(href) {
  if (/^#[a-z0-9-]+$/i.test(href) || /^https?:\/\/[^\s"<>]+$/i.test(href) || /^mailto:[^\s"<>?]+$/i.test(href) || /^\/[a-z0-9/-]*$/i.test(href)) return href;
  throw new Error('Link not allowed: ' + href);
}

// A node of the JSON: a string, or [tag, attributes or null, ...children].
function convert(node, stats) {
  if (typeof node === 'string') {
    const removed = node.match(DRAFT_NOTE);
    if (removed) stats.removed += removed.length;
    return node.replace(DRAFT_NOTE, '').replace(/\s+/g, ' ');
  }
  if (!ALLOWED.has(node.tag)) throw new Error(`<${node.tag}> isn't allowed in a legal text`);
  let kids = node.children.map((c) => convert(c, stats));
  if (BLOCK.has(node.tag)) kids = kids.filter((c) => typeof c !== 'string' || c.trim());
  // Whitespace at the start and end of a paragraph, heading or cell shows nothing.
  if (typeof kids[0] === 'string') kids[0] = kids[0].replace(/^ /, '');
  if (typeof kids[kids.length - 1] === 'string') kids[kids.length - 1] = kids[kids.length - 1].replace(/ $/, '');
  kids = kids.filter((c) => c !== '');
  const a = {};
  if (node.attrs.id && /^h[1-3]$/.test(node.tag)) a.id = node.attrs.id;
  if (node.tag === 'a') a.href = safeHref(node.attrs.href || '');
  return [node.tag, Object.keys(a).length ? a : null, ...kids];
}

export function legalToJson(html, source) {
  const doc = parse(html);
  const main = find(doc, (n) => n.tag === 'main');
  if (!main) throw new Error('No <main> in ' + source);
  const stats = { removed: 0 };
  const body = main.children.map((c) => convert(c, stats)).filter((c) => typeof c !== 'string' || c.trim());
  const h1 = body.find((n) => Array.isArray(n) && n[0] === 'h1');
  const aside = find(doc, (n) => n.tag === 'aside');
  const toc = aside
    ? aside.children
        .filter((c) => typeof c !== 'string' && c.tag === 'a')
        .map((a) => ({ href: safeHref(a.attrs.href), label: textOf(a).trim(), sub: /\bsub\b/.test(a.attrs.class || '') }))
    : [];
  for (const t of toc) {
    if (!find(main, (n) => n.attrs.id === t.href.slice(1))) throw new Error('The contents list points to a missing section: ' + t.href);
  }
  return { json: { source, title: h1 ? flat(h1) : '', toc, body }, removed: stats.removed };
}

// The plain text of a JSON node.
export const flat = (n) => (typeof n === 'string' ? n : n.slice(2).map(flat).join(''));

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('usage: node scripts/legal-to-json.mjs <in.html> <out.json>');
    process.exit(1);
  }
  const { json, removed } = legalToJson(readFileSync(input, 'utf8'), input);
  writeFileSync(output, JSON.stringify(json, null, 1) + '\n');
  console.log(`${output}: "${json.title}", ${json.toc.length} sections in the contents list, ${removed} drafting note(s) removed`);
}
