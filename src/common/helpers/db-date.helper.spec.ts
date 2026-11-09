import { todayAsDbDate } from './db-date.helper';

describe('todayAsDbDate', () => {
  it('uses the calendar date in the given timezone, not UTC', () => {
    // 20:00 UTC on Oct 24 is already 03:00 on Oct 25 in Jakarta (UTC+7)
    const now = new Date('2026-10-24T20:00:00Z');
    expect(todayAsDbDate('Asia/Jakarta', now).toISOString()).toBe(
      '2026-10-25T00:00:00.000Z',
    );
    expect(todayAsDbDate('UTC', now).toISOString()).toBe(
      '2026-10-24T00:00:00.000Z',
    );
  });

  it('handles timezones behind UTC', () => {
    // 02:00 UTC on Oct 25 is still Oct 24 in New York
    const now = new Date('2026-10-25T02:00:00Z');
    expect(todayAsDbDate('America/New_York', now).toISOString()).toBe(
      '2026-10-24T00:00:00.000Z',
    );
  });
});
