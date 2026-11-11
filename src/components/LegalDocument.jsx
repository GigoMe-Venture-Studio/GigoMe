import { Fragment, useEffect } from 'react';
import { Link, useLocation } from 'react-router';

// A legal text on /privacy or /terms, from src/legal/*.json (made from the
// supplied page by scripts/legal-to-json.mjs). The JSON holds the exact
// wording as nested [tag, attributes, ...children] arrays; they are turned
// into React elements here, never inserted as HTML. Section ids are kept, so
// /privacy#section-10 opens at that section.
const TAGS = new Set(['h1', 'h2', 'h3', 'p', 'strong', 'em', 'br', 'a', 'ul', 'ol', 'li', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'hr']);
const OUR_SITE = /^https:\/\/gigome\.org(\/[a-z0-9/-]*)?$/i;

function render(node, key) {
  if (typeof node === 'string') return node;
  const [tag, attrs, ...kids] = node;
  const children = kids.map((k, i) => render(k, i));
  if (tag === 'table') {
    // Wide tables scroll sideways inside their box on phones, not the page.
    return (
      <div className="legal-table" key={key} role="region" aria-label="Table" tabIndex={0}>
        <table>{children}</table>
      </div>
    );
  }
  if (tag === 'a') {
    const href = attrs.href;
    const ours = href.match(OUR_SITE);
    if (ours || href.startsWith('/')) return <Link key={key} to={ours ? ours[1] || '/' : href}>{children}</Link>;
    if (href.startsWith('#') || href.startsWith('mailto:')) return <a key={key} href={href}>{children}</a>;
    return <a key={key} href={href} rel="noopener noreferrer">{children}</a>;
  }
  if (!TAGS.has(tag)) return null;
  const Tag = tag;
  const props = { key };
  if (attrs && attrs.id) props.id = attrs.id;
  if (tag === 'h1') props.className = 'page-title';
  return children.length ? <Tag {...props}>{children}</Tag> : <Tag {...props} />;
}

function Contents({ toc }) {
  if (!toc.length) return null;
  return (
    <details className="legal-toc">
      <summary>On this page</summary>
      <ol>
        {toc.map((t) => (
          <li key={t.href} className={t.sub ? 'sub' : undefined}>
            <a href={t.href}>{t.label}</a>
          </li>
        ))}
      </ol>
    </details>
  );
}

export default function LegalDocument({ doc }) {
  const { hash } = useLocation();
  // Opened with #section-N (or a contents link pressed): go to that section
  // once the text is there.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) el.scrollIntoView();
  }, [hash]);

  // The contents list goes after the title and the version paragraph.
  const firstP = doc.body.findIndex((n) => Array.isArray(n) && n[0] === 'p');
  return (
    <article className="legal-doc">
      {doc.body.map((n, i) => (
        <Fragment key={i}>
          {render(n, i)}
          {i === firstP && <Contents toc={doc.toc} />}
        </Fragment>
      ))}
    </article>
  );
}
