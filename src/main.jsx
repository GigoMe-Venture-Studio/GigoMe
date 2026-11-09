import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App.jsx';
import { AppErrorBoundary } from './components/ErrorBoundary.jsx';
// Schibsted Grotesk, served from our own site (no request to Google Fonts).
import '@fontsource-variable/schibsted-grotesk/wght.css';
import './styles/site.css';
import './styles/auth.css';
import './styles/header.css';
import './styles/jobs.css';
import './styles/home.css';
import './styles/feedback.css';
import './styles/account.css';
import './styles/employer.css';
import './styles/admin.css';
import './styles/error.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);
