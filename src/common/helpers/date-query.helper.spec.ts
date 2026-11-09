import { BadRequestException } from '@nestjs/common';
import { parseDateQuery } from './date-query.helper';

const TZ = 'Asia/Jakarta'; // UTC+7

describe('parseDateQuery', () => {
  it('treats a bare date as the whole day in the given timezone', () => {
    expect(parseDateQuery('2026-10-24', 'from', TZ)?.toISOString()).toBe(
      '2026-10-23T17:00:00.000Z',
    );
    expect(parseDateQuery('2026-10-24', 'to', TZ)?.toISOString()).toBe(
      '2026-10-24T16:59:59.999Z',
    );
  });

  it('takes a full ISO datetime as-is', () => {
    expect(
      parseDateQuery('2026-10-24T08:30:00Z', 'from', TZ)?.toISOString(),
    ).toBe('2026-10-24T08:30:00.000Z');
  });

  it.each([[undefined], [null], ['']])('returns undefined for %p', (value) => {
    expect(parseDateQuery(value, 'from', TZ)).toBeUndefined();
  });

  it.each([['not-a-date'], ['2026-02-30'], ['2026-13-01']])(
    'rejects %p with a 400',
    (value) => {
      expect(() => parseDateQuery(value, 'to', TZ)).toThrow(
        BadRequestException,
      );
    },
  );
});
