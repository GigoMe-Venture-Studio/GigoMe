import PageShell from '../components/PageShell.jsx';
import LegalDocument from '../components/LegalDocument.jsx';
import privacy from '../legal/privacy.json';

// /privacy: the Privacy Notice, word for word as supplied
// (docs/legal/published/privacy-notice-v1.0.html, made into
// src/legal/privacy.json by scripts/legal-to-json.mjs). Loaded only when
// opened (App.jsx), so other pages don't download it.
export default function Privacy() {
  return (
    <PageShell className="legal-main">
      <LegalDocument doc={privacy} />
    </PageShell>
  );
}
