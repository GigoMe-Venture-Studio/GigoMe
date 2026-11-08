import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import CompanyForm from '../components/CompanyForm.jsx';
import EmployerGate from '../components/EmployerGate.jsx';
import { supabase } from '../lib/supabase.js';
import { createCompany } from '../lib/employer.js';
import { announceProfileChange } from '../lib/profile.js';
import { useCompanyAccount } from '../lib/useCompanyAccount.js';

// /employers/setup: a company account without a company creates it here.
export default function EmployerSetup() {
  return <PageShell>{supabase ? <Setup /> : <ConfigError />}</PageShell>;
}

function Setup() {
  const account = useCompanyAccount();
  const [created, setCreated] = useState(false);

  if (created) {
    return (
      <div className="auth-card">
        <h1>Thanks, your company is saved</h1>
        <p className="lead" role="status">We'll review your company, usually within 2 working days.</p>
        <p className="setup-next">Meanwhile you can prepare your jobs as drafts and submit them once your company is approved.</p>
        <div className="auth-buttons">
          <Link className="btn btn-primary" to="/dashboard">Go to your dashboard</Link>
        </div>
      </div>
    );
  }

  const gate = <EmployerGate account={account} here="/employers/setup" allowNoCompany />;
  if (account.status !== 'noCompany' && account.status !== 'ready') return gate;
  if (account.status === 'ready') return <Navigate to="/dashboard" replace />;

  async function onSave(fields) {
    await createCompany(fields);
    announceProfileChange();
    setCreated(true);
  }

  return (
    <div className="auth-card">
      <h1>Tell us about your company</h1>
      <p className="lead">We review every company before its jobs go live. This takes a minute.</p>
      <CompanyForm defaultEmail={account.session.user.email} submitLabel="Save company" onSave={onSave} requireTerms />
    </div>
  );
}
