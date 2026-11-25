// Writes the review files for the translator and the legal person:
//
//   docs/i18n/review-it.csv        every site text: page, key, English, Italian
//   docs/i18n/review-legal-it.csv  the legal texts, paragraph by paragraph:
//                                  document, section, English, Italian
//
//   node scripts/i18n-review.mjs
//
// Run it after changing src/i18n/*.json or src/legal/*.it.json
// (tests/unit/i18n-review.test.mjs fails while the files are out of date).
// UTF-8 with a byte-order mark, so Excel shows the accents.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

// Where each key prefix is shown.
const PAGES = [
  [/^(common|time|langSwitch)\./, 'Everywhere'],
  [/^(jobType|italian|category|language|payUnit|schedule|scheduleHours|pay|place|area|example|job|apply)\./, 'Job lists and job pages (labels)'],
  [/^header\./, 'Header'],
  [/^footer\./, 'Footer'],
  [/^feedback\./, 'Feedback button and panel'],
  [/^limits\./, 'Daily limit messages'],
  [/^(notFound|error|configError)\./, 'Error pages'],
  [/^seo\./, 'Browser tab titles and search results'],
  [/^legal\./, '/privacy and /terms'],
  [/^home\./, '/ (home page)'],
  [/^jobs\./, '/jobs'],
  [/^jobPage\./, '/jobs/<id> (job page)'],
  [/^jobCard\./, 'Job cards'],
  [/^map\./, 'Maps'],
  [/^save\./, 'Save button'],
  [/^share\./, 'Share button'],
  [/^report\./, 'Report this job'],
  [/^applyDemo\./, 'Apply on example listings (demo)'],
  [/^company\./, '/companies/<id> (company page)'],
  [/^description\./, 'Job descriptions'],
  [/^(login|codeLogin|captcha|auth|password)\./, '/login and the employer login (and passwords)'],
  [/^welcome\./, '/welcome'],
  [/^(account|myData)\./, '/account'],
  [/^profile\./, '/welcome and /account (profile fields)'],
  [/^signup\./, 'After signing up (confirmation)'],
  [/^termsBox\./, 'Terms checkbox'],
  [/^logout\./, 'Log out'],
  [/^employers\./, '/employers'],
  [/^setup\./, '/employers/setup'],
  [/^(dashboard|employer|employerGate)\./, '/dashboard'],
  [/^companyForm\./, '/employers/setup and /dashboard (company form)'],
  [/^(editor|picker|geocode)\./, '/dashboard/jobs (job form)'],
  [/^(saved|student)\./, '/saved'],
  [/^admin\./, '/admin (moderation)'],
  [/^(how|faq)\./, '/how-it-works'],
  [/^safety\./, '/safety']
];
export const pageOf = (key) => (PAGES.find(([re]) => re.test(key)) || [null, 'Other'])[1];

const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

export function siteCsv() {
  const en = read('src/i18n/en.json');
  const it = read('src/i18n/it.json');
  return csv([['page', 'key', 'English', 'Italian'], ...Object.keys(en).map((k) => [pageOf(k), k, en[k], it[k] ?? ''])]);
}

// A block's words, with element boundaries as spaces where they separate
// words (<br> and table cells).
const text = (n) => {
  if (typeof n === 'string') return n;
  const [tag, , ...kids] = n;
  if (tag === 'br') return '\n';
  const inner = kids.map(text).join(tag === 'tr' ? ' | ' : '');
  return tag === 'td' || tag === 'th' ? inner.trim() : inner;
};
const tidy = (s) => s.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();

// One row per heading, paragraph, list item or table row, in order.
function blocks(node, out) {
  if (typeof node === 'string') {
    if (node.trim()) out.push(node);
    return out;
  }
  const [tag, , ...kids] = node;
  if (['ul', 'ol', 'table', 'thead', 'tbody', 'blockquote'].includes(tag)) kids.forEach((k) => blocks(k, out));
  else if (tag === 'hr') return out;
  else out.push(node);
  return out;
}

export function legalCsv() {
  const rows = [['document', 'section', 'English', 'Italian']];
  for (const [name, label] of [['privacy', 'Privacy Notice'], ['terms', 'Terms and Conditions']]) {
    const en = read(`src/legal/${name}.json`);
    const it = read(`src/legal/${name}.it.json`);
    rows.push([label, '(page title)', en.title, it.title]);
    en.toc.forEach((x, i) => rows.push([label, `(contents) ${x.href}`, x.label, it.toc[i] ? it.toc[i].label : '']));
    const a = en.body.flatMap((n) => blocks(n, []));
    const b = it.body.flatMap((n) => blocks(n, []));
    let section = '';
    a.forEach((n, i) => {
      if (Array.isArray(n) && n[0] === 'h2') section = tidy(text(n));
      const id = Array.isArray(n) && n[1] && n[1].id ? `#${n[1].id} ` : '';
      rows.push([label, id + section, tidy(text(n)), b[i] ? tidy(text(b[i])) : '']);
    });
  }
  return csv(rows);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(new URL('docs/i18n/', root), { recursive: true });
  writeFileSync(new URL('docs/i18n/review-it.csv', root), siteCsv());
  writeFileSync(new URL('docs/i18n/review-legal-it.csv', root), legalCsv());
  console.log('Wrote docs/i18n/review-it.csv and docs/i18n/review-legal-it.csv');
}
