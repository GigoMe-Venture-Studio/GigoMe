import { Fragment } from 'react';
import { descriptionBlocks } from '../lib/description.js';

// A description written by an employer (job or company), shown with its
// headings, paragraphs, line breaks and short lists (src/lib/description.js).
// Every piece is rendered as text, never as HTML.
export default function JobText({ text, className = '' }) {
  const blocks = descriptionBlocks(text);
  return (
    <div className={'desc' + (className ? ' ' + className : '')}>
      {blocks.map((b, i) => {
        if (b.type === 'heading') return <h3 key={i} className="desc-h">{b.text}</h3>;
        if (b.type === 'list') {
          const List = b.ordered ? 'ol' : 'ul';
          return <List key={i}>{b.items.map((item, k) => <li key={k}>{item}</li>)}</List>;
        }
        return (
          <p key={i}>
            {b.lines.map((line, k) => (
              <Fragment key={k}>{k > 0 && <br />}{line}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
