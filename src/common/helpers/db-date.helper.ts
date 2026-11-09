import { dayjs } from './date.helper';

// Today's calendar date in `timezone` (pass APP_TIMEZONE), as UTC midnight —
// the same shape @db.Date columns are stored/read in. A local
// `setHours(0, 0, 0, 0)` is the PREVIOUS UTC day on a server ahead of UTC
// (e.g. Asia/Jakarta), and Prisma truncates a DateTime param to its UTC date
// when filtering a @db.Date column, so a `{ gte: today }` built from it
// silently matches yesterday's dates too.
export function todayAsDbDate(timezone: string, now: Date = new Date()): Date {
  const today = dayjs(now).tz(timezone).format('YYYY-MM-DD');
  return new Date(`${today}T00:00:00.000Z`);
}
