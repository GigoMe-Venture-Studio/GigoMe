import { useState } from 'react';
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
import { useCompanyAccount } from '../lib/useCompanyAccount.js';
import { useT } from '../lib/useLang.js';

// /employers/setup: a company account without a company creates it here.
export default function EmployerSetup() {
  return <PageShell>{supabase ? <Setup /> : <ConfigError />}</PageShell>;
}

function Setup() {
  const t = useT();
  const account = useCompanyAccount();
  // created: the saved company, to show the confirmation (CompanySubmitted).
  const [created, setCreated] = useState(null);

  if (created) return <CompanySubmitted companyName={created.name} email={created.email} />;

  const gate = <EmployerGate account={account} here="/employers/setup" allowNoCompany />;
  if (account.status !== 'noCompany' && account.status !== 'ready') return gate;
  if (account.status === 'ready') return <Navigate to="/dashboard" replace />;

  async function onSave(fields) {
    // The Terms box was ticked: record the version on the account first.
    await acceptTerms(account.session.user.id);
    const company = await createCompany(fields);
    announceProfileChange();
    setCreated({ name: company.name || fields.name, email: account.session.user.email });
  }

  return (
    <div className="auth-card">
      <h1>{t('setup.title')}</h1>
      <p className="lead">{t('setup.lead')}</p>
      <CompanyForm defaultEmail={account.session.user.email} submitLabel={t('setup.save')} onSave={onSave} requireTerms />
    </div>
  );
}
