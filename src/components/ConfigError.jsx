import { supabaseConfigError } from '../lib/supabase.js';
import { CONTACT_EMAIL } from '../lib/contact.js';

// Shown instead of a blank page when the build has no Supabase settings.
export default function ConfigError({ title = "Logging in isn't available right now" }) {
  return (
    <div className="auth-card" role="alert">
      <h1>{title}</h1>
      <p className="lead">
        GigoMe can't reach its database. Please try again later, or write to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      <p className="note auth-tech">For the GigoMe team: {supabaseConfigError}</p>
    </div>
  );
}
