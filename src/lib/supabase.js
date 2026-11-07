// Supabase client for the browser.
//
// Reads two Vite build variables (see .env.example). Both are safe to ship to
// the browser: the publishable key only allows what the database's row level
// security and grants allow. Never put the secret / service_role key here or
// anywhere else in this repo.
//
// If the variables are missing or wrong, `supabase` is null and
// `supabaseConfigError` says why, so pages can show a clear message instead of
// the whole site failing to load.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let client = null;
let configError = null;

if (!url || !publishableKey) {
  configError =
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local for ' +
    'local work, and set both as build variables in Cloudflare.';
} else {
  try {
    client = createClient(url, publishableKey);
  } catch (error) {
    configError = 'Could not start Supabase: ' + error.message;
  }
}

if (configError) console.error('[GigoMe] ' + configError);

export const supabase = client;
export const supabaseConfigError = configError;
