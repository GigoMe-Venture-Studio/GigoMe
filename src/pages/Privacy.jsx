import LegalPage from '../components/LegalPage.jsx';
import privacy from '../legal/privacy.json';

// /privacy: the Privacy Notice, word for word as supplied
// (docs/legal/published/privacy-notice-v1.3.html, made into
// src/legal/privacy.json by scripts/legal-to-json.mjs), or in Italian its
// courtesy translation (src/legal/privacy.it.json). Loaded only when opened
// (App.jsx), so other pages don't download it.
const loadItalian = () => import('../legal/privacy.it.json', { with: { type: 'json' } });

export default function Privacy() {
  return <LegalPage doc={privacy} loadItalian={loadItalian} />;
}
