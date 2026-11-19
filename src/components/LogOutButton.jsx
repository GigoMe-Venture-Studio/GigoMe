import { useId, useRef, useState } from 'react';
import { logOut } from '../lib/auth.js';
import { useT } from '../lib/useLang.js';

// "Log out" everywhere (header, phone menu, the "You're logged in" cards,
// /welcome): it first asks "Log out?" in a small dialog (native <dialog>),
// since logging back in needs a new code from the email. Cancel has the
// focus, so an accidental tap followed by Enter logs nobody out.
// onDone: after logging out (e.g. close the phone menu); onError: the message
// when it failed.
export default function LogOutButton({ className = '', onDone, onError }) {
  const dialog = useRef(null);
  const cancel = useRef(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const t = useT();

  function open() {
    if (!dialog.current) return;
    dialog.current.showModal();
    if (cancel.current) cancel.current.focus();
  }

  async function confirm() {
    setBusy(true);
    const error = await logOut();
    setBusy(false);
    if (dialog.current && dialog.current.open) dialog.current.close();
    if (error) {
      if (onError) onError(error);
    } else if (onDone) onDone();
  }

  return (
    <>
      <button type="button" className={className} onClick={open}>{t('logout.button')}</button>
      <dialog ref={dialog} className="logout-dialog" aria-labelledby={id + 't'} aria-describedby={id + 'd'}>
        <p className="logout-title" id={id + 't'}>{t('logout.title')}</p>
        <p className="logout-text" id={id + 'd'}>{t('logout.text')}</p>
        <div className="logout-buttons">
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy}>
            {busy ? t('logout.busy') : t('logout.button')}
          </button>
          <button type="button" ref={cancel} className="btn btn-secondary" onClick={() => dialog.current.close()} disabled={busy}>
            {t('common.cancel')}
          </button>
        </div>
      </dialog>
    </>
  );
}
