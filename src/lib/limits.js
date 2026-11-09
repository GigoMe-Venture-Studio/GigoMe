// The database refuses more than a set number of feedback messages, reports,
// saves and job submissions a day (migration 20261109100100_abuse_limits.sql)
// with errcode 54000 and a message written for people, e.g. "Daily limit
// reached: you can send feedback up to 20 times a day. Try again tomorrow."
// Returns that message, or null for any other error.
export function dailyLimitMessage(error) {
  if (!error) return null;
  const message = String(error.message || '');
  return error.code === '54000' || message.startsWith('Daily limit reached') ? message : null;
}
