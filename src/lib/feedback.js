import { supabase } from './supabase.js';

export const FEEDBACK_MAX = 2000;

// Saves one feedback message. Only logged-in users can send feedback: the
// database sets user_id itself (auth.uid()) and refuses anyone else. Nothing
// is read back, since only admins can read feedback.
export async function sendFeedback(message, page) {
  const text = String(message || '').trim();
  if (!text) return { error: 'Write a message first.' };
  if (text.length > FEEDBACK_MAX) return { error: `Keep it under ${FEEDBACK_MAX} characters.` };
  if (!supabase) return { error: "Feedback can't be sent right now." };
  const { error } = await supabase
    .from('feedback')
    .insert({ page: String(page || '').slice(0, 200), message: text });
  if (error) return { error: "We couldn't send your message. Check your connection and try again." };
  return { error: null };
}
