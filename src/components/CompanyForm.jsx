import { useState } from 'react';
import { normalizeEmail } from '../lib/auth.js';
import { isPlainEmail } from '../lib/links.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { normalizeUrl } from '../lib/employer.js';
import { websiteText } from '../lib/jobs.js';
import { TERMS_REQUIRED } from '../lib/terms.js';
import TermsCheckbox from './TermsCheckbox.jsx';
import { useT } from '../lib/useLang.js';

const DESCRIPTION_MAX = 1000;

// Company name, website, short description and contact email: on
// /employers/setup and in the dashboard. onSave(fields) saves and throws on
// failure; the form shows the error. Once the company is approved
// (identityLocked), name and website are shown but not sent: only GigoMe can
// change them (the database refuses it too).
// requireTerms (setup only): "I'm 18 or older and I accept the Terms" must be
// ticked. The database records when, on the company (on creation only); the
// setup page also records the version on the account (acceptTerms()).
export default function CompanyForm({ initial, defaultEmail = '', submitLabel, busyLabel, onSave, onCancel, identityLocked = false, requireTerms = false }) {
  const t = useT();
  const [values, setValues] = useState({
    name: (initial && initial.name) || '',
    website: (initial && initial.website) || '',
    description: (initial && initial.description) || '',
    contactEmail: (initial && initial.contact_email) || defaultEmail
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setSaveError('');
    const name = values.name.trim().replace(/\s+/g, ' ');
    const website = normalizeUrl(values.website);
    const description = values.description.trim();
    const email = normalizeEmail(values.contactEmail);
    const found = {};
    if (!identityLocked) {
      if (!name) found.name = t('companyForm.nameMissing');
      else if (name.length > 120) found.name = t('companyForm.nameTooLong');
      if (website === null || website.length > 300) found.website = t('companyForm.websiteInvalid');
    }
    if (description.length > DESCRIPTION_MAX) found.description = t('companyForm.descriptionTooLong', { max: DESCRIPTION_MAX });
    if (requireTerms && !termsAccepted) found.terms = TERMS_REQUIRED;
    if (!email) found.contactEmail = t('companyForm.emailMissing');
    else if (!isPlainEmail(email) || email.length > 254) found.contactEmail = t('companyForm.emailInvalid');
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const editable = { description: description || null, contact_email: email };
      const fields = identityLocked ? editable : { name, website: website || null, ...editable };
      // Any value means "accepted": the database stores its own time.
      if (requireTerms) fields.terms_accepted_at = new Date().toISOString();
      await onSave(fields);
    } catch {
      setSaveError(t('companyForm.saveError'));
      setBusy(false);
    }
  }

  return (
    <form className="auth-form company-form" onSubmit={onSubmit} noValidate>
      {identityLocked ? (
        <div className="locked-fields">
          <dl className="dash-facts">
            <div><dt>{t('companyForm.nameLabel')}</dt><dd>{initial.name}</dd></div>
            <div><dt>{t('companyForm.websiteLabel')}</dt><dd>{websiteText(initial.website) || <span className="muted">{t('companyForm.notAdded')}</span>}</dd></div>
          </dl>
          <p className="field-hint">{t('companyForm.changeThese', { email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> })}</p>
        </div>
      ) : (
        <>
          <label className="field">
            {t('companyForm.nameLabel')}
            <input className="input" type="text" name="company_name" autoComplete="organization" maxLength={120}
              value={values.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} required />
            {errors.name && <span className="err">{errors.name}</span>}
          </label>
          <label className="field">
            <span>{t('companyForm.websiteLabel')} <span className="field-optional">{t('companyForm.optional')}</span></span>
            <input className="input" type="text" name="website" inputMode="url" autoComplete="url" autoCapitalize="none" /* i18n-ignore: attribute values, not text */
              spellCheck="false" placeholder={t('companyForm.websitePlaceholder')} maxLength={300}
              value={values.website} onChange={set('website')} aria-invalid={Boolean(errors.website)} />
            {errors.website && <span className="err">{errors.website}</span>}
          </label>
        </>
      )}
      <label className="field">
        <span>{t('companyForm.descriptionLabel')} <span className="field-optional">{t('companyForm.optional')}</span></span>
        <textarea className="input textarea" name="company_description" rows={4} maxLength={DESCRIPTION_MAX}
          placeholder={t('companyForm.descriptionPlaceholder')}
          value={values.description} onChange={set('description')} aria-invalid={Boolean(errors.description)} />
        {errors.description && <span className="err">{errors.description}</span>}
      </label>
      <label className="field">
        {t('companyForm.contactEmailLabel')}
        <input className="input" type="email" name="contact_email" inputMode="email" autoComplete="email" autoCapitalize="none" /* i18n-ignore: attribute values, not text */
          spellCheck="false" maxLength={254}
          value={values.contactEmail} onChange={set('contactEmail')} aria-invalid={Boolean(errors.contactEmail)}
          aria-describedby="contact-email-hint" required />
        <span className="field-hint" id="contact-email-hint">{t('companyForm.contactEmailHint')}</span>
        {errors.contactEmail && <span className="err">{errors.contactEmail}</span>}
      </label>
      {requireTerms && <TermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} error={errors.terms} />}
      {saveError && <p className="err" role="alert">{saveError}</p>}
      <div className="form-buttons">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? busyLabel || t('companyForm.saving') : submitLabel}</button>
        {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>{t('common.cancel')}</button>}
      </div>
    </form>
  );
}
