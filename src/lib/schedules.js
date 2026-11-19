// When a job happens: the values allowed by jobs.schedule, their labels and
// what each one means. Testers read "Weekday mornings" differently, so the
// hours are defined here once and shown everywhere "When" appears (the /jobs
// filters, job cards and pages, the job form). The words are in the
// translation files (schedule.* and scheduleHours.*); only i18n.js is
// imported, so this stays unit-tested in tests/unit/schedules.test.mjs.
// A "flexible" job matches any "When" filter.
import { labelMap, labelPairs, t } from './i18n.js';

const VALUES = ['weekday_mornings', 'weekday_afternoons', 'weekday_evenings', 'weekends', 'flexible'];
export const SCHEDULES = labelPairs('schedule', VALUES);
export const SCHEDULE_LABEL = labelMap('schedule', VALUES);

// The definitions, one per value.
export const SCHEDULE_HOURS = labelMap('scheduleHours', VALUES);

// The same definitions in one short line, under "When" in the /jobs filters.
export const scheduleHoursLine = () => t('scheduleHours.line');

// In the order of the list, so labels always read the same way.
export const scheduleLabels = (job) => SCHEDULES.filter(([v]) => (job.schedule || []).includes(v)).map(([, l]) => l);
// [{ value, label, hours }] for a job's schedule, in list order.
export const scheduleItems = (job) =>
  SCHEDULES.filter(([v]) => (job.schedule || []).includes(v)).map(([value, label]) => ({ value, label, hours: SCHEDULE_HOURS[value] }));
