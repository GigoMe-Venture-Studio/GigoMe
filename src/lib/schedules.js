// When a job happens: the values allowed by jobs.schedule, their labels and
// what each one means. Testers read "Weekday mornings" differently, so the
// hours are defined here once and shown everywhere "When" appears (the /jobs
// filters, job cards and pages, the job form). No imports: unit-tested in
// tests/unit/schedules.test.mjs. A "flexible" job matches any "When" filter.
export const SCHEDULES = [
  ['weekday_mornings', 'Weekday mornings'],
  ['weekday_afternoons', 'Weekday afternoons'],
  ['weekday_evenings', 'Weekday evenings'],
  ['weekends', 'Weekends'],
  ['flexible', 'Flexible']
];
export const SCHEDULE_LABEL = Object.fromEntries(SCHEDULES);

// The definitions, one per value.
export const SCHEDULE_HOURS = {
  weekday_mornings: 'Mon to Fri, before 12:00',
  weekday_afternoons: 'Mon to Fri, 12:00 to 18:00',
  weekday_evenings: 'Mon to Fri, after 18:00',
  weekends: 'Saturday and Sunday, any time',
  flexible: 'Hours agreed with the employer'
};

// The same definitions in one short line, under "When" in the /jobs filters.
export const SCHEDULE_HOURS_LINE = 'Mornings before 12 · Afternoons 12 to 18 · Evenings after 18';

// In the order of the list, so labels always read the same way.
export const scheduleLabels = (job) => SCHEDULES.filter(([v]) => (job.schedule || []).includes(v)).map(([, l]) => l);
// [{ value, label, hours }] for a job's schedule, in list order.
export const scheduleItems = (job) =>
  SCHEDULES.filter(([v]) => (job.schedule || []).includes(v)).map(([value, label]) => ({ value, label, hours: SCHEDULE_HOURS[value] }));
