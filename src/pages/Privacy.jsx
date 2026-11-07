import PageShell from '../components/PageShell.jsx';
import { CONTACT_EMAIL } from '../lib/contact.js';

// Placeholder: the final privacy notice text will be supplied.
export default function Privacy() {
  return (
    <PageShell>
      <article className="auth-card auth-prose">
        <h1>Privacy notice</h1>
        <p className="lead">The full privacy notice is being finalised and will be published here.</p>
        <p>
          Questions about your data in the meantime? Write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </article>
    </PageShell>
  );
}
