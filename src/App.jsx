import { Routes, Route } from 'react-router';
import SiteHeader from './components/SiteHeader.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import { FeedbackProvider } from './components/Feedback.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import Home from './pages/Home.jsx';
import Jobs from './pages/Jobs.jsx';
import JobDetail from './pages/JobDetail.jsx';
import About from './pages/About.jsx';
import Account from './pages/Account.jsx';
import Employers from './pages/Employers.jsx';
import EmployerSetup from './pages/EmployerSetup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import JobEditor from './pages/JobEditor.jsx';
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
        <Route path="/about" element={<About />} />
        <Route path="/account" element={<Account />} />
        <Route path="/employers" element={<Employers />} />
        <Route path="/employers/setup" element={<EmployerSetup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/jobs/new" element={<JobEditor />} />
        <Route path="/dashboard/jobs/:id/edit" element={<JobEditor />} />
        <Route path="/login" element={<Login />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <SiteFooter />
    </FeedbackProvider>
  );
}
