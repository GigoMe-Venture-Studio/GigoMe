import { t } from './i18n.js';
import { dailyLimitMessage } from './limits.js';
import { supabase } from './supabase.js';

export const FEEDBACK_MAX = 2000;

// Saves one feedback message. Only logged-in users can send feedback: the
// database sets user_id itself (auth.uid()) and refuses anyone else. Nothing
// is read back, since only admins can read feedback.
export async function sendFeedback(message, page) {
  const text = String(message || '').trim();
  if (!text) return { error: t('feedback.errEmpty') };
  if (text.length > FEEDBACK_MAX) return { error: t('feedback.errTooLong', { max: String(FEEDBACK_MAX) }) };
  if (!supabase) return { error: t('feedback.errUnavailable') };
  const { error } = await supabase
    .from('feedback')
    .insert({ page: String(page || '').slice(0, 200), message: text });
  if (error) return { error: dailyLimitMessage(error) || t('feedback.errSend') };
  return { error: null };
}
