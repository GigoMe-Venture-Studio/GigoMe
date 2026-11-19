import { Link } from 'react-router';
import { useT } from '../lib/useLang.js';

// "I'm 18 or older and I accept the Terms", on /welcome and on the employer
// setup. The links open in a new tab, so nothing typed here is lost.
// People don't "accept" a privacy notice: it is only linked, as information.
export default function TermsCheckbox({ checked, onChange, error }) {
  const t = useT();
  return (
    <div className="field terms-field">
      <label className="check">
        <input type="checkbox" name="accept_terms" checked={checked} onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error)} aria-describedby="terms-hint" />{' '}
        <span>
          {t('termsBox.accept', { link: (s) => <Link to="/terms" target="_blank" rel="noopener noreferrer">{s}</Link> })}
        </span>
      </label>
      <span className="field-hint" id="terms-hint">
        {t('termsBox.hint', { link: (s) => <Link to="/privacy" target="_blank" rel="noopener noreferrer">{s}</Link> })}
      </span>
      {error && <span className="err">{error}</span>}
    </div>
  );
}
