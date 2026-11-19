import { supabaseConfigError } from '../lib/supabase.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { useT } from '../lib/useLang.js';

// Shown instead of a blank page when the build has no Supabase settings.
// The technical line for the team stays in English.
export default function ConfigError({ title }) {
  const t = useT();
  return (
    <div className="auth-card" role="alert">
      <h1>{title || t('configError.title')}</h1>
      <p className="lead">
        {t('configError.text', { email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> })}
      </p>
      <p className="note auth-tech">{t('configError.team')} {supabaseConfigError}</p>
    </div>
  );
}
