// Supabase client for the browser.
//
// Reads two Vite build variables (see .env.example). Both are safe to ship to
// the browser: the publishable key only allows what the database's row level
// security and grants allow. Never put the secret / service_role key here or
// anywhere else in this repo.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy .env.example to .env.local for local work, and set both as build variables in Cloudflare.'
  );
}

export const supabase = createClient(url, publishableKey);
