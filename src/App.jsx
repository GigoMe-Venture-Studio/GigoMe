import { Routes, Route } from 'react-router';
import SiteHeader from './components/SiteHeader.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Welcome from './pages/Welcome.jsx';
import Privacy from './pages/Privacy.jsx';
import NotFound from './pages/NotFound.jsx';

// The demo's own screens (#jobs, #job/w1, #signup, ...) are hash links
// handled inside the home page, so they all live under "/".
export default function App() {
  return (
    <>
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
