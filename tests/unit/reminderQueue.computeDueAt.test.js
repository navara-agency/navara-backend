const { computeDueAt } = require('../../src/services/reminderQueue');

describe('reminderQueue.computeDueAt', () => {
  const now = new Date('2026-05-18T10:00:00.000Z');

  test('booking far in the future → due 2 hours before the meeting', () => {
    const start = new Date('2026-05-19T10:00:00.000Z'); // +24h
    const due = computeDueAt(start, now);
    // exactly 2h before bookingStart
    expect(due.toISOString()).toBe('2026-05-19T08:00:00.000Z');
  });

  test('booking exactly 2h away → due right now', () => {
    const start = new Date('2026-05-18T12:00:00.000Z'); // +2h
    const due = computeDueAt(start, now);
    expect(due.toISOString()).toBe(now.toISOString());
  });

  test('booking < 2h away (e.g. 90 min) → due now, not in the past', () => {
    const start = new Date('2026-05-18T11:30:00.000Z'); // +90 min
    const due = computeDueAt(start, now);
    expect(due.toISOString()).toBe(now.toISOString());
  });

  test('booking already in the past → still due now, not negative', () => {
    const start = new Date('2026-05-18T09:00:00.000Z'); // -1h
    const due = computeDueAt(start, now);
    expect(due.toISOString()).toBe(now.toISOString());
  });

  test('accepts ISO string input', () => {
    const due = computeDueAt('2026-05-19T10:00:00.000Z', now);
    expect(due.toISOString()).toBe('2026-05-19T08:00:00.000Z');
  });
});
