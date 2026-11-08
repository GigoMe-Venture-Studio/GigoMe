import PageShell from '../components/PageShell.jsx';
import { CONTACT_EMAIL } from '../lib/contact.js';

// Placeholder: the final privacy notice text will be supplied.
export default function Privacy() {
  return (
    <PageShell>
      <article className="auth-card auth-prose legal-page">
        <h1>Privacy notice</h1>
        <p className="lead">The full privacy notice is being finalised and will be published here.</p>
        <h2>Who operates GigoMe</h2>
        <p className="placeholder-text">[Who operates GigoMe: to be filled in]</p>
        <p>
          Questions about your data in the meantime? Write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </article>
    </PageShell>
  );
}
