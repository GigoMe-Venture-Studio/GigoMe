import { Suspense, lazy } from 'react';
import { Navigate, Routes, Route } from 'react-router';
import SiteHeader from './components/SiteHeader.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import { FeedbackProvider } from './components/Feedback.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import EmailLanguageSync from './components/EmailLanguageSync.jsx';
import TermsGate from './components/TermsGate.jsx';
import { PageErrorBoundary } from './components/ErrorBoundary.jsx';
import { RouteMeta } from './lib/seo.js';
import { useLang, useT } from './lib/useLang.js';
import Home from './pages/Home.jsx';
import Jobs from './pages/Jobs.jsx';
import JobDetail from './pages/JobDetail.jsx';
import Company from './pages/Company.jsx';
import Saved from './pages/Saved.jsx';
import Account from './pages/Account.jsx';
import Employers from './pages/Employers.jsx';
import EmployerSetup from './pages/EmployerSetup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import JobEditor from './pages/JobEditor.jsx';
import Admin from './pages/Admin.jsx';
import Login from './pages/Login.jsx';
import Welcome from './pages/Welcome.jsx';
import NotFound from './pages/NotFound.jsx';

// The legal texts are long: downloaded only when /privacy or /terms is opened.
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));
const HowItWorks = lazy(() => import('./pages/HowItWorks.jsx'));
const Safety = lazy(() => import('./pages/Safety.jsx'));
function LoadingPage() {
  const t = useT();
  return <main className="wrap legal-main"><p className="muted">{t('common.loading')}</p></main>;
}
const loadingPage = <LoadingPage />;

export default function App() {
  // Everything renders again in the new language when it changes (labels
  // made by plain functions like payLabel() included).
  useLang();
  return (
    <FeedbackProvider>
      <ScrollToTop />
      <EmailLanguageSync />
      <RouteMeta />
      <SiteHeader />
      <PageErrorBoundary>
        <TermsGate>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/companies/:id" element={<Company />} />
            {/* The About page was removed; old links land on the home page. */}
            <Route path="/about" element={<Navigate to="/" replace />} />
            <Route path="/account" element={<Account />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/employers" element={<Employers />} />
            <Route path="/employers/setup" element={<EmployerSetup />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/jobs/new" element={<JobEditor />} />
            <Route path="/dashboard/jobs/:id/edit" element={<JobEditor />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/privacy" element={<Suspense fallback={loadingPage}><Privacy /></Suspense>} />
            <Route path="/terms" element={<Suspense fallback={loadingPage}><Terms /></Suspense>} />
            <Route path="/how-it-works" element={<Suspense fallback={loadingPage}><HowItWorks /></Suspense>} />
            <Route path="/safety" element={<Suspense fallback={loadingPage}><Safety /></Suspense>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TermsGate>
      </PageErrorBoundary>
      <SiteFooter />
    </FeedbackProvider>
  );
}
