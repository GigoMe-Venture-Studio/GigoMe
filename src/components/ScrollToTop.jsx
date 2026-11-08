import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

// A new page starts at the top. Back and Forward keep the browser's own
// scroll position, and changing only the query (the /jobs filters) doesn't
// move the page.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  const typeRef = useRef(type);
  typeRef.current = type;

  useEffect(() => {
    if (typeRef.current !== 'POP') window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
