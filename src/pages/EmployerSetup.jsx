import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import CompanyForm from '../components/CompanyForm.jsx';
import EmployerGate from '../components/EmployerGate.jsx';
import { CompanySubmitted } from '../components/SignupDone.jsx';
import { supabase } from '../lib/supabase.js';
import { createCompany } from '../lib/employer.js';
import { announceProfileChange } from '../lib/profile.js';
import { acceptTerms } from '../lib/terms.js';
import { hasPassword, setPassword } from '../lib/password.js';
import { useCompanyAccount } from '../lib/useCompanyAccount.js';
import { useT } from '../lib/useLang.js';

// /employers/setup: a company account without a company creates it here.
// An account without a password chooses one here too (the email code is
// needed only at sign-up). It's set first, so a refused password saves
// nothing; if Supabase wants a more recent login first, the company is
// created anyway and the password is asked for after the next code login.
export default function EmployerSetup() {
  return <PageShell>{supabase ? <Setup /> : <ConfigError />}</PageShell>;
}

function Setup() {
  const t = useT();
  const account = useCompanyAccount();
  // created: the saved company, to show the confirmation (CompanySubmitted).
  const [created, setCreated] = useState(null);
  // Whether the account still needs a password: null while asking.
  const [needsPassword, setNeedsPassword] = useState(null);
  const userId = account.session ? account.session.user.id : null;
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    hasPassword().then((has) => active && setNeedsPassword(!has));
    return () => {
      active = false;
    };
  }, [userId]);
  const [passwordDone, setPasswordDone] = useState(null); // null | 'set' | 'later'

  if (created) return <CompanySubmitted companyName={created.name} email={created.email} withPassword={created.withPassword} />;

  const gate = <EmployerGate account={account} here="/employers/setup" allowNoCompany />;
  if (account.status !== 'noCompany' && account.status !== 'ready') return gate;
  if (account.status === 'ready') return <Navigate to="/dashboard" replace />;
  if (needsPassword === null) return <p className="auth-card muted">{t('common.loading')}</p>;

  async function onSave(fields, password) {
    let state = passwordDone;
    if (password && !passwordDone) {
      const failed = await setPassword(password);
      if (failed && !failed.reauth) throw Object.assign(new Error('password'), { userMessage: failed.error }); // i18n-ignore: internal error, never shown
      state = failed ? 'later' : 'set';
      setPasswordDone(state);
    }
    // The Terms box was ticked: record the version on the account first.
    await acceptTerms(account.session.user.id);
    const company = await createCompany(fields);
    announceProfileChange();
    setCreated({ name: company.name || fields.name, email: account.session.user.email, withPassword: !needsPassword || state === 'set' });
  }

  return (
    <div className="auth-card">
      <h1>{t('setup.title')}</h1>
      <p className="lead">{t('setup.lead')}</p>
      <CompanyForm
        defaultEmail={account.session.user.email}
        submitLabel={t('setup.save')}
        onSave={onSave}
        requireTerms
        passwordFor={needsPassword && !passwordDone ? account.session.user.email : ''}
      />
    </div>
  );
}
