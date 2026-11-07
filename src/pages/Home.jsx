import { memo, useEffect, useRef } from 'react';
import markup from '../legacy/markup.html?raw';
import { mountLegacyApp } from '../legacy/app.js';
import AccountBar from '../components/AccountBar.jsx';

// The home page is the original GigoMe demo. Each time it mounts, it gets a
// fresh copy of the original markup and runs the original script on it, so it
// looks and behaves exactly as the old index.html did. React never renders
// anything inside this div itself.
function Home() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    el.innerHTML = markup;
    const unmount = mountLegacyApp();
    return () => {
      unmount();
      el.innerHTML = '';
    };
  }, []);

  return (
    <>
      <AccountBar />
      <div ref={ref} />
    </>
  );
}

export default memo(Home);
