import PageShell from '../components/PageShell.jsx';
import LegalDocument from '../components/LegalDocument.jsx';
import terms from '../legal/terms.json';

// /terms: the Terms and Conditions, word for word as supplied
// (docs/legal/published/terms-and-conditions-v2.0.html, made into
// src/legal/terms.json by scripts/legal-to-json.mjs). Employers accept them
// when they set up their company (/employers/setup). Loaded only when opened
// (App.jsx), so other pages don't download it.
export default function Terms() {
  return (
    <PageShell className="legal-main">
      <LegalDocument doc={terms} />
    </PageShell>
  );
}
