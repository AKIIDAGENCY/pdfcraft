/**
 * `Math.ceil` (and similarly `Math.round`/`Math.floor`) on a small negative
 * fraction yields `-0` (e.g. `Math.ceil(-0.3) === -0`). That's numerically
 * equal to 0 (`-0 === 0`), so alert-level branching on it is unaffected —
 * but `Intl.NumberFormat` renders `-0` with a visible minus sign, which
 * reads as "-0 days remaining" to a judge. Normalize it before display.
 */
export function normalizeZero(n: number): number {
  return n === 0 ? 0 : n;
}

/**
 * `Date.setMonth` with no clamping overflows into the following month when
 * the target month is shorter than the start day (e.g. Jan 31 + 1 month
 * becomes Mar 3, not Feb 28). Every statutory deadline in this app is
 * computed as "N months from X" (detention terms, renewals, Chamber
 * extensions, interception windows), so an unclamped add silently pushes
 * real deadlines 1-3+ days too late whenever the start date falls near
 * month-end — a systemic over-detention risk invisible to tests seeded
 * with 1st-of-month dates.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const daysInTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, daysInTargetMonth));
  return result;
}
