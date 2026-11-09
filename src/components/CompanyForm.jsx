import { useState } from 'react';
import { Link } from 'react-router';
import { normalizeEmail } from '../lib/auth.js';
import { isPlainEmail } from '../lib/links.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { normalizeUrl } from '../lib/employer.js';
import { websiteText } from '../lib/jobs.js';

const DESCRIPTION_MAX = 1000;

// Company name, website, short description and contact email: on
// /employers/setup and in the dashboard. onSave(fields) saves and throws on
// failure; the form shows the error. Once the company is approved
// (identityLocked), name and website are shown but not sent: only GigoMe can
// change them (the database refuses it too).
// requireTerms (setup only): an "I accept the terms" box that must be ticked;
// the database records when, on creation only.
export default function CompanyForm({ initial, defaultEmail = '', submitLabel, busyLabel = 'Saving…', onSave, onCancel, identityLocked = false, requireTerms = false }) {
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
      if (!name) found.name = 'Add your company name.';
      else if (name.length > 120) found.name = 'Keep the name under 120 characters.';
      if (website === null || website.length > 300) found.website = 'Enter a web address like www.yourcompany.it, or leave it empty.';
    }
    if (description.length > DESCRIPTION_MAX) found.description = `Keep it under ${DESCRIPTION_MAX} characters.`;
    if (requireTerms && !termsAccepted) found.terms = 'Accept the terms to continue.';
    if (!email) found.contactEmail = 'Add an email address we can reach you at.';
    else if (!isPlainEmail(email) || email.length > 254) found.contactEmail = "That email address doesn't look right.";
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
      setSaveError("We couldn't save your company. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form className="auth-form company-form" onSubmit={onSubmit} noValidate>
      {identityLocked ? (
        <div className="locked-fields">
          <dl className="dash-facts">
            <div><dt>Company name</dt><dd>{initial.name}</dd></div>
            <div><dt>Website</dt><dd>{websiteText(initial.website) || <span className="muted">Not added</span>}</dd></div>
          </dl>
          <p className="field-hint">To change these, write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </div>
      ) : (
        <>
          <label className="field">
            Company name
            <input className="input" type="text" name="company_name" autoComplete="organization" maxLength={120}
              value={values.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} required />
            {errors.name && <span className="err">{errors.name}</span>}
          </label>
          <label className="field">
            <span>Website <span className="field-optional">(optional)</span></span>
            <input className="input" type="text" name="website" inputMode="url" autoComplete="url" autoCapitalize="none"
              spellCheck="false" placeholder="www.yourcompany.it" maxLength={300}
              value={values.website} onChange={set('website')} aria-invalid={Boolean(errors.website)} />
            {errors.website && <span className="err">{errors.website}</span>}
          </label>
        </>
      )}
      <label className="field">
        <span>Short description <span className="field-optional">(optional)</span></span>
        <textarea className="input textarea" name="company_description" rows={4} maxLength={DESCRIPTION_MAX}
          placeholder="What you do, in a sentence or two. Students see this on your jobs."
          value={values.description} onChange={set('description')} aria-invalid={Boolean(errors.description)} />
        {errors.description && <span className="err">{errors.description}</span>}
      </label>
      <label className="field">
        Contact email
        <input className="input" type="email" name="contact_email" inputMode="email" autoComplete="email" autoCapitalize="none"
          spellCheck="false" maxLength={254}
          value={values.contactEmail} onChange={set('contactEmail')} aria-invalid={Boolean(errors.contactEmail)}
          aria-describedby="contact-email-hint" required />
        <span className="field-hint" id="contact-email-hint">Only the GigoMe team sees this. Students apply the way you set on each job.</span>
        {errors.contactEmail && <span className="err">{errors.contactEmail}</span>}
      </label>
      {requireTerms && (
        <div className="field terms-field">
          <label className="check">
            <input type="checkbox" name="accept_terms" checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)} aria-invalid={Boolean(errors.terms)} />{' '}
            <span>
              I accept the <Link to="/terms" target="_blank" rel="noopener noreferrer">terms</Link>
            </span>
          </label>
          {errors.terms && <span className="err">{errors.terms}</span>}
        </div>
      )}
      {saveError && <p className="err" role="alert">{saveError}</p>}
      <div className="form-buttons">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? busyLabel : submitLabel}</button>
        {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>}
      </div>
    </form>
  );
}
