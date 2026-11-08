import { Navigate, Routes, Route } from 'react-router';
import SiteHeader from './components/SiteHeader.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import { FeedbackProvider } from './components/Feedback.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import Home from './pages/Home.jsx';
import Jobs from './pages/Jobs.jsx';
import JobDetail from './pages/JobDetail.jsx';
import Terms from './pages/Terms.jsx';
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
import Privacy from './pages/Privacy.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <FeedbackProvider>
      <ScrollToTop />
      <SiteHeader />
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
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <SiteFooter />
    </FeedbackProvider>
  );
}
