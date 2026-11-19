import { useEffect, useState } from 'react';
import PageShell from './PageShell.jsx';
import LegalDocument from './LegalDocument.jsx';
import { useLang, useT } from '../lib/useLang.js';

// /privacy and /terms. In English: the text word for word as supplied. In
// Italian: the courtesy translation (src/legal/*.it.json, downloaded only
// then), under a line saying the English version prevails. If it can't be
// downloaded, the English text is shown with a note.
export default function LegalPage({ doc, loadItalian }) {
  const t = useT();
  const lang = useLang();
  const [italian, setItalian] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (lang !== 'it' || italian) return undefined;
    let active = true;
    loadItalian()
      .then((m) => active && setItalian(m.default))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [lang, italian, loadItalian]);

  const showItalian = lang === 'it' && italian;
  return (
    <PageShell className="legal-main">
      {showItalian && <p className="legal-courtesy" role="note">{t('legal.courtesy')}</p>}
      {lang === 'it' && failed && <p className="legal-courtesy" role="note">{t('legal.loadFailed')}</p>}
      {lang === 'it' && !italian && !failed ? (
        <p className="muted">{t('common.loading')}</p>
      ) : (
        <LegalDocument doc={showItalian ? italian : doc} />
      )}
    </PageShell>
  );
}
