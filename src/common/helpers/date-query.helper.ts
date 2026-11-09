import { BadRequestException } from '@nestjs/common';
import { dayjs } from './date.helper';
import { ErrorMessageHelper } from './error-message.helper';

// Parses a `from` / `to` query param. A bare date (YYYY-MM-DD) is a whole day
// in `timezone` (pass APP_TIMEZONE): `from` → start of that day, `to` → end of
// it. A full ISO datetime is taken as-is. Empty → undefined; anything
// unparseable → 400.
export function parseDateQuery(
  value: string | null | undefined,
  bound: 'from' | 'to',
  timezone: string,
): Date | undefined {
  if (!value) return undefined;

  let date: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const day = dayjs.tz(value, timezone);
    // Reject dates that roll over, e.g. 2026-02-30 → March 2
    date =
      day.isValid() && day.format('YYYY-MM-DD') === value
        ? (bound === 'from' ? day.startOf('day') : day.endOf('day')).toDate()
        : new Date(NaN);
  } else {
    date = new Date(value);
  }

  if (isNaN(date.getTime())) {
    throw new BadRequestException(
      ErrorMessageHelper.getMultiLanguageMessage('INVALID_DATE_FORMAT'),
    );
  }
  return date;
}
