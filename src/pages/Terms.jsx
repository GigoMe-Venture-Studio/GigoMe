import LegalPage from '../components/LegalPage.jsx';
import terms from '../legal/terms.json';

// /terms: the Terms and Conditions, word for word as supplied
// (docs/legal/published/terms-and-conditions-v2.0.html, made into
// src/legal/terms.json by scripts/legal-to-json.mjs), or in Italian their
// courtesy translation (src/legal/terms.it.json). Employers accept them
// when they set up their company (/employers/setup). Loaded only when opened
// (App.jsx), so other pages don't download it.
const loadItalian = () => import('../legal/terms.it.json', { with: { type: 'json' } });

export default function Terms() {
  return <LegalPage doc={terms} loadItalian={loadItalian} />;
}
