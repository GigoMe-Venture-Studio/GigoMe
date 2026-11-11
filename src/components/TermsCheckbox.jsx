import { Link } from 'react-router';

// "I'm 18 or older and I accept the Terms", on /welcome and on the employer
// setup. The links open in a new tab, so nothing typed here is lost.
// People don't "accept" a privacy notice: it is only linked, as information.
export default function TermsCheckbox({ checked, onChange, error }) {
  return (
    <div className="field terms-field">
      <label className="check">
        <input type="checkbox" name="accept_terms" checked={checked} onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error)} aria-describedby="terms-hint" />{' '}
        <span>
          I'm 18 or older and I accept the <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms</Link>
        </span>
      </label>
      <span className="field-hint" id="terms-hint">
        How we use your data: <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</Link>.
      </span>
      {error && <span className="err">{error}</span>}
    </div>
  );
}
