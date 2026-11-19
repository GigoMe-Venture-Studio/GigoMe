// The database refuses more than a set number of feedback messages, reports,
// saves and job submissions a day (migration 20261109100100_abuse_limits.sql)
// with errcode 54000 and a message written for people, e.g. "Daily limit
// reached: you can send feedback up to 20 times a day. Try again tomorrow."
// Returns that message (in English as the database wrote it; in Italian the
// same sentence from the translation files), or null for any other error.
import { getLang, t } from './i18n.js';

// What the database says each limit is about, and its translation key.
const WHAT = {
  'send feedback': 'limits.feedback',
  'report a job': 'limits.report',
  'save jobs or searches and follow companies': 'limits.saves',
  'submit jobs for review': 'limits.submit'
};

export function dailyLimitMessage(error) {
  if (!error) return null;
  const message = String(error.message || '');
  if (!(error.code === '54000' || message.startsWith('Daily limit reached'))) return null; // i18n-ignore: the database's words
  if (getLang() === 'en') return message;
  const m = message.match(/^Daily limit reached: you can (.+) up to (\d+) times a day\./); // i18n-ignore: the database's words
  return m && WHAT[m[1]] ? t(WHAT[m[1]], { max: m[2] }) : t('limits.generic');
}
