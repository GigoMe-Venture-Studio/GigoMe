import { useEffect, useRef } from 'react';
import { TURNSTILE_SITE_KEY, captchaEnabled, loadTurnstile } from '../lib/captcha.js';

// The Turnstile check on the login form. Shows nothing unless Cloudflare
// needs the person to interact. onToken(token) gets a fresh token, or '' when
// it expires or fails; onError() when the check can't run at all. Changing
// resetSignal asks for a new token (each token works only once).
export default function Turnstile({ onToken, onError, resetSignal }) {
  const box = useRef(null);
  const widget = useRef(null);
  const handlers = useRef({ onToken, onError });
  handlers.current = { onToken, onError };

  useEffect(() => {
    if (!captchaEnabled) return undefined;
    let gone = false;
    loadTurnstile()
      .then((ts) => {
        if (gone || !box.current) return;
        widget.current = ts.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: 'login',
          appearance: 'interaction-only',
          callback: (token) => handlers.current.onToken(token),
          'expired-callback': () => handlers.current.onToken(''),
          'timeout-callback': () => handlers.current.onToken(''),
          'error-callback': () => {
            handlers.current.onToken('');
            if (handlers.current.onError) handlers.current.onError();
          }
        });
      })
      .catch(() => {
        if (!gone && handlers.current.onError) handlers.current.onError();
      });
    return () => {
      gone = true;
      if (widget.current !== null && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    if (!resetSignal || widget.current === null || !window.turnstile) return;
    handlers.current.onToken('');
    window.turnstile.reset(widget.current);
  }, [resetSignal]);

  if (!captchaEnabled) return null;
  return <div className="captcha" ref={box} />;
}
