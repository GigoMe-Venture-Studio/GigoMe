import { useId, useState } from 'react';
import { PASSWORD_MIN } from '../lib/password.js';
import { useT } from '../lib/useLang.js';

// Choosing a password: the password, the same again, the rules as visible
// text (never only a tooltip) and "Show password". Used on /welcome, the
// employer setup, after a code login (SetPasswordStep in CodeLogin.jsx) and
// on /account. values: { password, confirm }; onChange(key, value); error:
// one message for the pair. email: the account's, so password managers save
// the password under the right login.
export default function PasswordFields({ email, values, onChange, error, label }) {
  const t = useT();
  const id = useId();
  const [show, setShow] = useState(false);
  const type = show ? 'text' : 'password';
  return (
    <div className="password-fields">
      {email && (
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden /* i18n-ignore: attribute values, not text */ />
      )}
      <label className="field">
        {label || t('password.newLabel')}
        <input
          className="input"
          type={type}
          name="new-password"
          autoComplete="new-password" /* i18n-ignore: attribute value, not text */
          autoCapitalize="none"
          spellCheck="false"
          value={values.password}
          onChange={(e) => onChange('password', e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={id + '-rules'}
        />
      </label>
      <p className="field-hint password-rules" id={id + '-rules'}>{t('password.rules', { n: PASSWORD_MIN })}</p>
      <label className="field">
        {t('password.confirmLabel')}
        <input
          className="input"
          type={type}
          name="confirm-password"
          autoComplete="new-password" /* i18n-ignore: attribute value, not text */
          autoCapitalize="none"
          spellCheck="false"
          value={values.confirm}
          onChange={(e) => onChange('confirm', e.target.value)}
          aria-invalid={Boolean(error)}
        />
      </label>
      <label className="check password-show">
        <input type="checkbox" name="show-password" checked={show} onChange={(e) => setShow(e.target.checked)} /> {t('password.show')}
      </label>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
