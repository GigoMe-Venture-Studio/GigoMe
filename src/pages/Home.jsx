import { memo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import markup from '../legacy/markup.html?raw';
import { mountLegacyApp } from '../legacy/app.js';

// The home page is the original GigoMe demo. Each time it mounts, it gets a
// fresh copy of the original markup and runs the original script on it, so it
// looks and behaves exactly as the old index.html did. React never renders
// anything inside this div itself.
function Home() {
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const el = ref.current;
    el.innerHTML = markup;
    const unmount = mountLegacyApp();
    return () => {
      unmount();
      el.innerHTML = '';
    };
  }, []);

  // Links in the demo to real pages (such as /jobs) go through React Router,
  // so the site doesn't reload. Hash links (#about) are left to the demo.
  function onClick(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href.startsWith('/') || href.startsWith('//')) return;
    e.preventDefault();
    navigate(href);
  }

  return <div ref={ref} className="demo-root" onClick={onClick} />;
}

export default memo(Home);
