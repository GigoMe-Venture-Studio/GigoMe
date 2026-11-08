import { useEffect, useRef, useState } from 'react';

// "Share" on job pages. On phones (touch screens that can share), the
// phone's own share sheet; elsewhere "Copy link", with a confirmation. The
// link is the job's normal address, so it opens the job page with the site's
// usual link preview. Nothing is sent to GigoMe.
const phoneShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

export default function ShareButton({ title, url, disabled = false }) {
  const [state, setState] = useState('idle'); // idle | copied | manual
  const field = useRef(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const sheet = phoneShare();

  async function onClick() {
    if (sheet) {
      try {
        await navigator.share({ title: `${title} | GigoMe`, url });
      } catch {
        /* closed without sharing */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState('idle'), 3000);
    } catch {
      // No clipboard (an older browser, or permission refused): show the link
      // selected, ready to copy by hand.
      setState('manual');
      setTimeout(() => field.current && field.current.select(), 0);
    }
  }

  return (
    <span className="share-wrap">
      <button type="button" className="share-btn" onClick={onClick} disabled={disabled}>
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
          {sheet ? (
            <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
          ) : (
            <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
          )}
        </svg>
        <span>{sheet ? 'Share' : state === 'copied' ? 'Link copied' : 'Copy link'}</span>
      </button>
      <span className="share-status" role="status">{state === 'copied' ? 'Link copied to the clipboard.' : ''}</span>
      {state === 'manual' && (
        <input ref={field} className="input share-field" readOnly value={url} aria-label="Link to this job" onFocus={(e) => e.target.select()} />
      )}
    </span>
  );
}
