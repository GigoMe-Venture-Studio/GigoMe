// A job's (or company's) plain-text description, split into blocks so job
// pages can show headings, paragraphs and short lists cleanly. The text is
// never parsed as HTML: each block is rendered as React text
// (src/components/JobText.jsx). No imports: unit-tested in
// tests/unit/description.test.mjs.
//
//   "What you'll do:"        -> a heading (a short line ending with ":",
//                               or one of the job form's three headings)
//   "- serve coffee"         -> a list item ("-", "*", "•" or "1." / "1)")
//   other lines              -> paragraphs; a blank line starts a new one,
//                               single line breaks are kept inside it

// The structure the job form suggests (JobEditor.jsx).
export const DESCRIPTION_HEADINGS = ["What you'll do", "Who we're looking for", 'Practical details'];

const BULLET = /^\s*(?:[-*•–]|\d{1,2}[.)])\s+(.+)$/;
const NUMBERED = /^\s*\d{1,2}[.)]\s+/;
const KNOWN = new Set(DESCRIPTION_HEADINGS.map((h) => h.toLowerCase()));

function headingText(line) {
  const t = line.trim();
  const bare = t.replace(/:$/, '').trim();
  if (KNOWN.has(bare.toLowerCase().replace(/’/g, "'"))) return bare;
  if (t.endsWith(':') && bare.length > 0 && bare.length <= 60 && !bare.includes(':') && !BULLET.test(t)) return bare;
  return null;
}

export function descriptionBlocks(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = null;
  let list = null;
  const end = () => {
    para = null;
    list = null;
  };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return end();
    const bullet = line.match(BULLET);
    if (bullet) {
      const ordered = NUMBERED.test(line);
      if (!list || list.ordered !== ordered) {
        para = null;
        list = { type: 'list', ordered, items: [] };
        blocks.push(list);
      }
      list.items.push(bullet[1].trim());
      return;
    }
    // A heading needs something after it, else it's just a line of text.
    const rest = lines.slice(i + 1).some((l) => l.trim());
    const heading = rest ? headingText(line) : null;
    if (heading) {
      end();
      blocks.push({ type: 'heading', text: heading });
      return;
    }
    if (!para) {
      list = null;
      para = { type: 'paragraph', lines: [] };
      blocks.push(para);
    }
    para.lines.push(line);
  });
  return blocks;
}
