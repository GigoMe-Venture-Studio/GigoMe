import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App.jsx';
import './styles/site.css';
import './styles/auth.css';
import './styles/header.css';
import './styles/jobs.css';
import './styles/home.css';
import './styles/feedback.css';
import './styles/account.css';
import './styles/employer.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
