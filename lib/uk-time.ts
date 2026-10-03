/**
 * Scheduled jobs and UK time.
 *
 * Vercel's scheduler only understands UTC, and UK clocks move twice a year —
 * so a job fixed at "08:00 UTC" runs at 9am for half the year and 8am for
 * the other half. Each job is scheduled at both possible hours instead, and
 * does nothing unless it's really the hour meant in London.
 */
export function ukHourNow(at: Date = new Date()): number {
  return Number(
    at.toLocaleString("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hour12: false,
    })
  );
}

/** Today's date in the UK, as YYYY-MM-DD. */
export const ukToday = (at: Date = new Date()) =>
  at.toLocaleDateString("en-CA", { timeZone: "Europe/London" });

/** The UK date a given number of days from now. */
export const ukDateIn = (days: number, at: Date = new Date()) =>
  ukToday(new Date(at.getTime() + days * 24 * 60 * 60 * 1000));

/**
 * Whether a job should act now. `manual` skips the check, for testing.
 */
export const isUkHour = (hour: number, manual = false) =>
  manual || ukHourNow() === hour;
