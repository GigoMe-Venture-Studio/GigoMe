import PageShell from '../components/PageShell.jsx';
import { CONTACT_EMAIL } from '../lib/contact.js';

// Placeholder: the terms of use will be supplied. Employers accept them when
// they set up their company (/employers/setup).
export default function Terms() {
  return (
    <PageShell>
      <article className="auth-card auth-prose legal-page">
        <h1>Terms of use</h1>
        <p className="lead">The full terms of use are being finalised and will be published here.</p>
        <p className="placeholder-text">[Terms of use: to be filled in]</p>
        <h2>Who operates GigoMe</h2>
        <p className="placeholder-text">[Who operates GigoMe: to be filled in]</p>
        <p>
          Questions in the meantime? Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </article>
    </PageShell>
  );
}
