import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

// Where each history entry was last scrolled to (in memory, for this tab
// only).
const positions = new Map();
// How long Back/Forward keeps trying to reach the old position while the
// page fills in (a job list still loading is too short to scroll to it).
const RESTORE_MS = 3000;

// A new page starts at the top. Back and Forward return to where that page
// was left, once it is tall enough again (the browser's own restoration
// happens while a list is still loading, so it lands near the top), and
// changing only the query (the /jobs filters) doesn't move the page.
export default function ScrollToTop() {
  const { pathname, key } = useLocation();
  const type = useNavigationType();
  const typeRef = useRef(type);
  typeRef.current = type;
  const keyRef = useRef(key);
  keyRef.current = key;

  // Where the current history entry is scrolled to, kept up to date as the
  // person scrolls (by the time a new page's effects run, the browser may
  // already have moved the old position to fit the new, shorter page).
  useEffect(() => {
    const save = () => positions.set(keyRef.current, window.scrollY);
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, []);

  useEffect(() => {
    if (typeRef.current !== 'POP') {
      window.scrollTo(0, 0);
      return undefined;
    }
    const target = positions.get(keyRef.current);
    return target > 0 ? restore(target) : undefined;
  }, [pathname]);

  return null;
}

// Scrolls to y as soon as the page is tall enough, until it gets there,
// the person scrolls or touches the page, or RESTORE_MS passes.
function restore(y) {
  let frame = 0;
  const until = Date.now() + RESTORE_MS;
  const cancel = () => {
    cancelAnimationFrame(frame);
    for (const e of ['wheel', 'touchstart', 'keydown', 'mousedown']) window.removeEventListener(e, cancel);
  };
  for (const e of ['wheel', 'touchstart', 'keydown', 'mousedown']) window.addEventListener(e, cancel, { passive: true });
  const step = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.min(y, Math.max(0, max)));
    if (max >= y || Date.now() > until) cancel();
    else frame = requestAnimationFrame(step);
  };
  step();
  return cancel;
}
