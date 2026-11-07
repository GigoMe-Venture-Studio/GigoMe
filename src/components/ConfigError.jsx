import { supabaseConfigError } from '../lib/supabase.js';
import { CONTACT_EMAIL } from '../lib/contact.js';

// Shown instead of a blank page when the build has no Supabase settings.
export default function ConfigError() {
  return (
    <div className="auth-card" role="alert">
      <h1>Logging in isn't available right now</h1>
      <p className="lead">
        GigoMe can't reach its login service. Please try again later, or write to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      <p className="note auth-tech">For the GigoMe team: {supabaseConfigError}</p>
    </div>
  );
}
