const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** "March 2024". Always UTC so builds on any machine agree. */
export function formatMonthYear(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Milliseconds at 00:00 UTC of the UTC calendar day containing `d`. */
export function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
