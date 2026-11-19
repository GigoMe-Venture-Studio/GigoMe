import { useEffect, useRef } from 'react';
import { useSession } from '../lib/useSession.js';
import { useLang } from '../lib/useLang.js';
import { languageToSave, saveEmailLanguage } from '../lib/emailLanguage.js';

// Keeps the account's email language (src/lib/emailLanguage.js) the same as
// the site's: right after logging in, and when a logged-in user switches
// language. Renders nothing. One attempt per account and language, so a
// failing request isn't repeated on every render.
export default function EmailLanguageSync() {
  const { session } = useSession();
  const lang = useLang();
  const tried = useRef('');
  const user = session ? session.user : null;
  const want = languageToSave(user, lang);
  const key = user && want ? `${user.id}:${want}` : '';

  useEffect(() => {
    if (!key || tried.current === key) return;
    tried.current = key;
    saveEmailLanguage(want).catch(() => {});
  }, [key, want]);

  return null;
}
