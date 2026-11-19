// English and Italian (src/lib/i18n.js, src/i18n/en.json, src/i18n/it.json).
//
// 1. Both files have exactly the same keys, nothing empty, and the same
//    {placeholders} and <tags> in each text.
// 2. No visible English is written straight into the code: every .js/.jsx
//    file in src/ is parsed (with Rolldown's parser, which Vite already
//    brings) and these fail the test unless the line says `i18n-ignore`:
//      - text between JSX tags (<p>Hello</p>);
//      - a string given to a JSX prop other than code-like ones
//        (className, href, type, ...), also through ? : && || ;
//      - a string anywhere that reads like a sentence (starts with a capital
//        letter and has several words, or ends with . ! ? : …).
//    Brand names, addresses and symbols are allowed (ALLOWED below).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';

const root = fileURLToPath(new URL('../../', import.meta.url));
const en = JSON.parse(readFileSync(join(root, 'src/i18n/en.json'), 'utf8'));
const it = JSON.parse(readFileSync(join(root, 'src/i18n/it.json'), 'utf8'));

const marks = (s) => [...s.matchAll(/\{(\w+)\}|<(\/?\w+)>/g)].map((m) => m[0]).sort();

test('English and Italian have exactly the same keys', () => {
  const missingIt = Object.keys(en).filter((k) => !(k in it));
  const missingEn = Object.keys(it).filter((k) => !(k in en));
  assert.deepEqual(missingIt, [], 'missing in it.json');
  assert.deepEqual(missingEn, [], 'missing in en.json');
});

test('no empty texts, and the same placeholders and tags in both languages', () => {
  const bad = [];
  for (const k of Object.keys(en)) {
    if (typeof en[k] !== 'string' || !en[k].trim()) bad.push(`${k}: empty in en.json`);
    if (typeof it[k] !== 'string' || !it[k].trim()) bad.push(`${k}: empty in it.json`);
    else if (marks(en[k]).join() !== marks(it[k]).join()) bad.push(`${k}: ${marks(en[k])} vs ${marks(it[k])}`);
  }
  assert.deepEqual(bad, []);
});

test('plural texts come in pairs (_one and _other)', () => {
  const bad = Object.keys(en).filter((k) => /_one$/.test(k) && !(k.replace(/_one$/, '_other') in en));
  assert.deepEqual(bad, []);
});

// ---- 2. no hard-coded English
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(f)) files.push(p);
  }
})(join(root, 'src'));

// Words that are the same in every language.
const ALLOWED = /^(GigoMe|EN|IT|M[1-5]|OpenStreetMap|OpenFreeMap|MapLibre|Nominatim|Google Maps|Supabase|Cloudflare|Turnstile|DELETE|€|·|\||×|✕|@)$/;
const looksLikeAddress = (s) => /^\S+@\S+\.\S+$/.test(s) || /^https?:\/\//.test(s) || /^\/[\w/-]*$/.test(s);
// Props that hold code, not words.
const CODE_PROPS = new Set([
  'className', 'id', 'key', 'type', 'name', 'href', 'to', 'role', 'value', 'defaultValue', 'htmlFor', 'autoComplete',
  'inputMode', 'pattern', 'method', 'rel', 'target', 'src', 'srcSet', 'media', 'lang', 'dir', 'enterKeyHint', 'step',
  'min', 'max', 'mode', 'audience', 'variant', 'size', 'loading', 'decoding', 'form', 'accept', 'kind', 'as', 'state',
  'aria-controls', 'aria-describedby', 'aria-labelledby', 'aria-current', 'aria-live', 'aria-haspopup', 'aria-expanded',
  'aria-pressed', 'aria-hidden', 'aria-invalid', 'aria-required', 'aria-busy', 'aria-modal', 'aria-atomic',
  'aria-autocomplete', 'aria-checked', 'aria-selected', 'aria-sort', 'aria-orientation', 'data-away', 'width',
  'height', 'viewBox', 'd', 'fill', 'stroke', 'xmlns', 'focusable', 'autoCapitalize', 'spellCheck', 'autoCorrect', 'next', 'returnTo', 'path', 'anchor'
]);
const hasWords = (s) => /\p{L}{2,}/u.test(s);
const okText = (s) => {
  const v = s.replace(/\s+/g, ' ').trim();
  return !v || !hasWords(v) || ALLOWED.test(v) || looksLikeAddress(v);
};
// A sentence: "Save this search", "Try again.", "Loading…", "Note:".
const prose = (s) => {
  const v = s.replace(/\s+/g, ' ').trim();
  if (okText(v)) return false;
  if (/^[A-Z][a-z’']+(?: [A-Za-z’'(),.;:!?&-]+)+$/.test(v)) return true;
  return / /.test(v) && /[.!?:…]$/.test(v) && /[a-z]{2,} [a-z]{2,}/.test(v);
};

function check(file) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const lineOf = (pos) => src.slice(0, pos).split('\n').length;
  const ignored = (pos) => /i18n-ignore/.test(lines[lineOf(pos) - 1] || '') || /i18n-ignore/.test(lines[lineOf(pos) - 2] || '');
  const ast = parseAst(src, { lang: file.endsWith('.jsx') ? 'jsx' : 'js' }, file);
  const found = [];
  const report = (node, text, why) => {
    if (!ignored(node.start)) found.push(`${relative(root, file)}:${lineOf(node.start)} ${why}: ${JSON.stringify(text.replace(/\s+/g, ' ').trim())}`);
  };
  // Strings that end up on the screen through a JSX prop or child.
  const shown = (node, why) => {
    if (!node) return;
    if (node.type === 'Literal' && typeof node.value === 'string') {
      if (!okText(node.value)) report(node, node.value, why);
    } else if (node.type === 'TemplateLiteral') {
      for (const q of node.quasis) if (!okText(q.value.cooked || '')) report(q, q.value.cooked, why);
    } else if (node.type === 'ConditionalExpression') {
      shown(node.consequent, why);
      shown(node.alternate, why);
    } else if (node.type === 'LogicalExpression') {
      shown(node.right, why);
      if (node.operator !== '&&') shown(node.left, why);
    } else if (node.type === 'JSXExpressionContainer') shown(node.expression, why);
  };
  // Not screen text: import paths, keys given to t(), what code compares or searches for.
  const skipped = new WeakSet();
  const skip = { add: (n) => n && typeof n === 'object' && skipped.add(n), has: (n) => skipped.has(n) };
  (function walk(node, parent) {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'ImportDeclaration':
      case 'ExportAllDeclaration':
        return;
      case 'ExportNamedDeclaration':
        if (node.source) skip.add(node.source);
        break;
      case 'ImportExpression':
        return;
      case 'CallExpression': {
        const c = node.callee;
        const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && c.property ? c.property.name : '';
        const obj = c.type === 'MemberExpression' && c.object && c.object.type === 'Identifier' ? c.object.name : '';
        if (['t', 'includes', 'startsWith', 'endsWith', 'indexOf', 'match', 'test', 'querySelector', 'querySelectorAll', 'closest',
          'matches', 'getItem', 'setItem', 'removeItem', 'addEventListener', 'removeEventListener', 'dispatchEvent', 'Event',
          'CustomEvent', 'get', 'set', 'has', 'getAll', 'delete', 'append', 'select', 'from', 'rpc', 'eq', 'neq', 'order', 'is',
          'not', 'in', 'or', 'ilike', 'overlaps', 'contains', 'setAttribute', 'getAttribute', 'removeAttribute', 'createElement',
          'replace', 'split', 'join', 'mailtoHref', 'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'keys'].includes(name) || obj === 'console') {
          node.arguments.forEach((a) => skip.add(a));
        }
        break;
      }
      case 'BinaryExpression':
        if (['===', '!==', '==', '!='].includes(node.operator)) {
          skip.add(node.left);
          skip.add(node.right);
        }
        break;
      case 'Property':
        if (!node.computed) skip.add(node.key);
        break;
      case 'MemberExpression':
        if (node.computed) skip.add(node.property);
        break;
      case 'SwitchCase':
        skip.add(node.test);
        break;
      case 'JSXText':
        if (!okText(node.value)) report(node, node.value, 'text in JSX');
        return;
      case 'JSXAttribute': {
        const n = node.name.type === 'JSXIdentifier' ? node.name.name : `${node.name.namespace.name}:${node.name.name.name}`;
        if (!CODE_PROPS.has(n) && !/^on[A-Z]/.test(n) && !/^data-/.test(n)) shown(node.value, `prop ${n}`);
        if (node.value) skip.add(node.value);
        break;
      }
      case 'JSXExpressionContainer':
        if (parent && (parent.type === 'JSXElement' || parent.type === 'JSXFragment')) shown(node.expression, 'text in JSX');
        break;
      case 'Literal':
        if (!skip.has(node) && typeof node.value === 'string' && prose(node.value)) report(node, node.value, 'sentence in code');
        return;
      case 'TemplateLiteral':
        if (!skip.has(node)) for (const q of node.quasis) if (prose(q.value.cooked || '')) report(q, q.value.cooked, 'sentence in code');
        break;
    }
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end') continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c === 'object' && walk(c, node));
      else if (v && typeof v === 'object' && typeof v.type === 'string') {
        if (skip.has(node) && v.type === 'Literal') skip.add(v);
        walk(v, node);
      }
    }
  })(ast, null);
  return found;
}

test('no visible English written into the code (it goes through t())', () => {
  const found = files.filter((f) => !/src[\\/]lib[\\/](i18n|useLang)\.js$/.test(f)).flatMap(check);
  assert.deepEqual(found, [], `${found.length} texts are not in the translation files`);
});
