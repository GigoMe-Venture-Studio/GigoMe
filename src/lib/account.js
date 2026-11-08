import { supabase } from './supabase.js';

// The logged-in user's profile with their university's name (for /account).
export async function fetchAccount(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, degree_level, graduation_year, account_type, universities(name)')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Deletes the caller's own account: the database function works only on the
// logged-in user. Returns an error message, or null when it's done.
export async function deleteMyAccount() {
  const { error } = await supabase.rpc('delete_my_account');
  return error ? "We couldn't delete your account. Check your connection and try again." : null;
}

// After deleting: clear the session on this device. The server may refuse the
// logout (the user is gone), but supabase-js clears the local session anyway.
export function endDeletedSession() {
  return supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
