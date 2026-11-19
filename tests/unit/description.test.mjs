// Job descriptions as blocks (src/lib/description.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DESCRIPTION_HEADINGS, DESCRIPTION_HEADINGS_IT, descriptionBlocks } from '../../src/lib/description.js';

test('the suggested structure: headings, lists, paragraphs', () => {
  const text = "What you'll do:\n- serve coffee\n- run the till\n\nWho we're looking for\nSomeone friendly.\nNo experience needed.\n\nPractical details:\n1. Saturdays\n2) Sundays";
  assert.deepEqual(descriptionBlocks(text), [
    { type: 'heading', text: "What you'll do" },
    { type: 'list', ordered: false, items: ['serve coffee', 'run the till'] },
    { type: 'heading', text: "Who we're looking for" },
    { type: 'paragraph', lines: ['Someone friendly.', 'No experience needed.'] },
    { type: 'heading', text: 'Practical details' },
    { type: 'list', ordered: true, items: ['Saturdays', 'Sundays'] }
  ]);
  assert.deepEqual(DESCRIPTION_HEADINGS, ["What you'll do", "Who we're looking for", 'Practical details']);
});

test('the Italian headings the form suggests in Italian, in any case, with or without ":"', () => {
  const text = 'Cosa farai\n- servire caffè\n\nCHI CERCHIAMO:\nUna persona gentile.\n\ndettagli pratici\n1. Sabato';
  assert.deepEqual(descriptionBlocks(text), [
    { type: 'heading', text: 'Cosa farai' },
    { type: 'list', ordered: false, items: ['servire caffè'] },
    { type: 'heading', text: 'CHI CERCHIAMO' },
    { type: 'paragraph', lines: ['Una persona gentile.'] },
    { type: 'heading', text: 'dettagli pratici' },
    { type: 'list', ordered: true, items: ['Sabato'] }
  ]);
  assert.deepEqual(DESCRIPTION_HEADINGS_IT, ['Cosa farai', 'Chi cerchiamo', 'Dettagli pratici']);
  // The translation files' headings (what the job form suggests) are the ones recognised.
  const en = JSON.parse(readFileSync(new URL('../../src/i18n/en.json', import.meta.url), 'utf8'));
  const it = JSON.parse(readFileSync(new URL('../../src/i18n/it.json', import.meta.url), 'utf8'));
  const keys = ['description.headingDo', 'description.headingWho', 'description.headingDetails'];
  assert.deepEqual(keys.map((k) => en[k]), DESCRIPTION_HEADINGS);
  assert.deepEqual(keys.map((k) => it[k]), DESCRIPTION_HEADINGS_IT);
});

test('plain text stays plain: paragraphs and line breaks', () => {
  assert.deepEqual(descriptionBlocks('One line.\nSecond line.\n\n\nNew paragraph.'), [
    { type: 'paragraph', lines: ['One line.', 'Second line.'] },
    { type: 'paragraph', lines: ['New paragraph.'] }
  ]);
  assert.deepEqual(descriptionBlocks('\r\n  Windows line.\r\nNext.  \r\n'), [{ type: 'paragraph', lines: ['Windows line.', 'Next.'] }]);
  assert.deepEqual(descriptionBlocks(''), []);
  assert.deepEqual(descriptionBlocks(null), []);
});

test('not headings: a colon inside, too long, last line, or a list item', () => {
  assert.deepEqual(descriptionBlocks('Note: bring ID.\nPay: €10/h:'), [{ type: 'paragraph', lines: ['Note: bring ID.', 'Pay: €10/h:'] }]);
  const long = 'A'.repeat(61) + ':';
  assert.equal(descriptionBlocks(long + '\nmore')[0].type, 'paragraph');
  assert.deepEqual(descriptionBlocks('Text\nWhat we offer:'), [{ type: 'paragraph', lines: ['Text', 'What we offer:'] }]);
  assert.deepEqual(descriptionBlocks('- Tasks:\n- more'), [{ type: 'list', ordered: false, items: ['Tasks:', 'more'] }]);
});

test('lists: bullets of any kind, a paragraph after a list, mixed kinds split', () => {
  assert.deepEqual(descriptionBlocks('• one\n* two\n– three\nAfter.'), [
    { type: 'list', ordered: false, items: ['one', 'two', 'three'] },
    { type: 'paragraph', lines: ['After.'] }
  ]);
  assert.deepEqual(descriptionBlocks('- a\n1. b').map((b) => b.ordered), [false, true]);
  assert.equal(descriptionBlocks('-not a bullet')[0].type, 'paragraph');
  assert.equal(descriptionBlocks('2026 was busy.')[0].type, 'paragraph');
});

test('HTML-looking text is just text', () => {
  assert.deepEqual(descriptionBlocks('<b>hi</b>\n- <script>x</script>'), [
    { type: 'paragraph', lines: ['<b>hi</b>'] },
    { type: 'list', ordered: false, items: ['<script>x</script>'] }
  ]);
});
