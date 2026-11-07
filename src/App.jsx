import { Routes, Route } from 'react-router';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';

// Two routes only. The demo's own screens (#jobs, #job/w1, #signup, ...) are
// hash links handled inside the home page, so they all live under "/".
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
