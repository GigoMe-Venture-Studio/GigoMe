// The "When" values and what each one means (src/lib/schedules.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEDULES, SCHEDULE_HOURS, scheduleHoursLine, scheduleItems, scheduleLabels } from '../../src/lib/schedules.js';

test('every schedule has exactly one definition', () => {
  assert.deepEqual(Object.keys(SCHEDULE_HOURS), SCHEDULES.map(([v]) => v));
});

test('the definitions testers asked for, word for word', () => {
  assert.deepEqual({ ...SCHEDULE_HOURS }, {
    weekday_mornings: 'Mon to Fri, before 12:00',
    weekday_afternoons: 'Mon to Fri, 12:00 to 18:00',
    weekday_evenings: 'Mon to Fri, after 18:00',
    weekends: 'Saturday and Sunday, any time',
    flexible: 'Hours agreed with the employer'
  });
  assert.equal(scheduleHoursLine(), 'Mornings before 12 · Afternoons 12 to 18 · Evenings after 18');
});

test('a job\'s schedule reads in list order, with its hours', () => {
  const job = { schedule: ['weekends', 'weekday_mornings'] };
  assert.deepEqual(scheduleLabels(job), ['Weekday mornings', 'Weekends']);
  assert.deepEqual(scheduleItems(job), [
    { value: 'weekday_mornings', label: 'Weekday mornings', hours: 'Mon to Fri, before 12:00' },
    { value: 'weekends', label: 'Weekends', hours: 'Saturday and Sunday, any time' }
  ]);
  assert.deepEqual(scheduleItems({ schedule: null }), []);
});
