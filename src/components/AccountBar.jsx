import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import { logOut } from '../lib/auth.js';

// A slim bar above the home page, shown only while a student is logged in.
export default function AccountBar() {
  const { session } = useSession();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!supabase || !session) return null;

  async function onLogOut() {
    setBusy(true);
    setError((await logOut()) || '');
    setBusy(false);
  }

  return (
    <div className="account-bar">
      <div className="wrap">
        <span className="account-email">
          Logged in as <strong>{session.user.email}</strong>
        </span>
        <button type="button" className="btn-link" onClick={onLogOut} disabled={busy}>
          Log out
        </button>
        {error && <span className="err" role="alert">{error}</span>}
      </div>
    </div>
  );
}
