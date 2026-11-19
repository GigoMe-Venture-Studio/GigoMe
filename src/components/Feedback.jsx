import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useSession } from '../lib/useSession.js';
import { FEEDBACK_MAX, sendFeedback } from '../lib/feedback.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { useT } from '../lib/useLang.js';

const FeedbackContext = createContext(() => {});

// Opens the feedback panel (used by the footer's "Give feedback").
export function useOpenFeedback() {
  return useContext(FeedbackContext);
}

// Wraps the app: the floating "Feedback" button and the feedback panel.
export function FeedbackProvider({ children }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // Focus goes back to whatever opened the panel (the floating button or the
  // footer's "Give feedback") once it is closed. The dialog's own focus
  // return can't be relied on: it runs the moment the dialog closes, while
  // the floating button is still hidden (it hides while the panel is open),
  // so focus could land nowhere. This runs after the button is shown again.
  const opener = useRef(null);
  const restore = useRef(false);
  const openFeedback = useCallback((e) => {
    const el = e && e.currentTarget instanceof HTMLElement ? e.currentTarget : document.activeElement;
    opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
    setOpen(true);
  }, []);
  const closeFeedback = useCallback(() => {
    restore.current = true;
    setOpen(false);
  }, []);

  // Moving to another page closes it too, without moving the focus back.
  useEffect(() => {
    restore.current = false;
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open || !restore.current) return;
    restore.current = false;
    const el = opener.current;
    opener.current = null;
    if (el && el.isConnected && document.activeElement !== el) el.focus();
  }, [open]);

  return (
    <FeedbackContext.Provider value={openFeedback}>
      {children}
      <FeedbackButton hidden={open} onOpen={openFeedback} />
      <FeedbackPanel open={open} onClose={closeFeedback} />
    </FeedbackContext.Provider>
  );
}

// Everything the floating button must never cover. Whole job cards are left
// out: the button can sit over a card's edge, the rest of the card still works.
// So is the footer's "Give feedback": it opens the same panel as the button.
const KEEP_CLEAR = [
  'main a:not(.role-row)',
  'main button',
  'main input',
  'main select',
  'main textarea',
  '.site-footer a',
  '.site-footer button:not(.footer-link-btn)',
  '.menu-panel a',
  '.menu-panel button',
  // The map's credits (OpenStreetMap, OpenFreeMap) must stay readable.
  '.maplibregl-ctrl-attrib'
].join(',');

const overlaps = (a, b, pad) =>
  a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;

// Fixed at the bottom right. It steps out of the way (fades out) whenever it
// would overlap a button, link or field, e.g. "Apply" or "Search jobs"
// on a phone, and comes back once that has scrolled past.
function FeedbackButton({ hidden, onOpen }) {
  const t = useT();
  const ref = useRef(null);
  const [covering, setCovering] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const button = ref.current;
      if (!button) return;
      const mine = button.getBoundingClientRect();
      let hit = false;
      for (const el of document.querySelectorAll(KEEP_CLEAR)) {
        const r = el.getBoundingClientRect();
        if (r.width && r.height && overlaps(r, mine, 8)) {
          hit = true;
          break;
        }
      }
      setCovering(hit);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    schedule();
    const vv = window.visualViewport;
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    if (vv) vv.addEventListener('resize', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    // Layout can also move without any DOM change or scroll: the web font
    // arriving, images loading, the page growing or shrinking.
    window.addEventListener('load', schedule);
    const fonts = document.fonts;
    if (fonts) {
      fonts.addEventListener('loadingdone', schedule);
      fonts.ready.then(schedule).catch(() => {});
    }
    const sizes = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    if (sizes) sizes.observe(document.body);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('load', schedule);
      if (vv) vv.removeEventListener('resize', schedule);
      if (fonts) fonts.removeEventListener('loadingdone', schedule);
      if (sizes) sizes.disconnect();
      observer.disconnect();
    };
  }, []);

  const away = hidden || covering;
  return (
    <button
      type="button"
      ref={ref}
      className="btn btn-secondary feedback-fab"
      data-away={away ? 'true' : undefined}
      data-panel-open={hidden ? 'true' : undefined}
      aria-hidden={covering ? 'true' : undefined}
      tabIndex={covering ? -1 : undefined}
      onClick={onOpen}
    >
      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {/* Under 768px only the icon shows (feedback.css), so the button covers
          less of the job cards; the word stays for screen readers. */}
      <span className="feedback-fab-label">{t('feedback.button')}</span>
    </button>
  );
}

function FeedbackPanel({ open, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="feedback-dialog"
      aria-labelledby="feedback-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {open && <FeedbackBody onClose={onClose} />}
    </dialog>
  );
}

// Kept outside the panel so a half-written message survives closing it.
let draft = '';

function FeedbackBody({ onClose }) {
  const t = useT();
  const { session, loading } = useSession();
  const { pathname, search } = useLocation();
  const [text, setText] = useState(draft);
  const [state, setState] = useState({ status: 'idle', error: '' });
  const field = useRef(null);

  useEffect(() => {
    draft = text;
  }, [text]);

  useEffect(() => {
    if (session && field.current) field.current.focus();
  }, [session]);

  useEffect(() => {
    if (state.status !== 'sent') return undefined;
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [state.status, onClose]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!text.trim() || state.status === 'busy') return;
    setState({ status: 'busy', error: '' });
    const { error } = await sendFeedback(text, pathname + search);
    if (error) {
      setState({ status: 'idle', error });
      return;
    }
    draft = '';
    setText('');
    setState({ status: 'sent', error: '' });
  }

  let body;
  if (state.status === 'sent') {
    body = <p className="feedback-thanks" role="status">{t('feedback.thanks')}</p>;
  } else if (loading) {
    body = <p className="muted">{t('common.loading')}</p>;
  } else if (!session) {
    body = (
      <p>
        {t('feedback.loggedOut', {
          link: (s) => <Link to={`/login?next=${encodeURIComponent(pathname + search)}`}>{s}</Link>,
          email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        })}
      </p>
    );
  } else {
    const busy = state.status === 'busy';
    body = (
      <form className="feedback-form" onSubmit={onSubmit} noValidate>
        <label className="feedback-label" htmlFor="feedback-message">
          {t('feedback.question')}
        </label>
        <textarea
          ref={field}
          id="feedback-message"
          className="input feedback-text"
          rows={6}
          maxLength={FEEDBACK_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby="feedback-count"
          aria-invalid={state.error ? 'true' : undefined}
        />
        <p className="feedback-count muted tnum" id="feedback-count">
          {text.length} / {FEEDBACK_MAX}
        </p>
        {state.error && <p className="err" role="alert">{state.error}</p>}
        <div className="feedback-actions">
          <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
            {busy ? t('feedback.sending') : t('feedback.send')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="feedback-inner">
      <div className="feedback-head">
        <h2 id="feedback-title">{t('feedback.title')}</h2>
        <button type="button" className="btn btn-tertiary btn-sm" onClick={onClose}>{t('common.close')}</button>
      </div>
      {body}
    </div>
  );
}
