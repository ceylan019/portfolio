/** The fixture build's fixed "today" (spec section 8). Fixture content is a static file
 * set, so its expiry examples (expired, expiring today, expiring in the future) stay
 * correct only if "today" is pinned rather than read from the system clock; otherwise the
 * "expiring today" fixture would silently become expired the day after this was written
 * (ruling T13-A). */
export const FIXTURE_TODAY = new Date('2026-09-27T00:00:00Z');

/** Picks the date that display rules in src/lib/ should treat as today: the fixed fixture
 * date for a fixture build, the real clock otherwise. Callers pass their own `now` so this
 * stays a pure function (spec section 5, "Functions take today as a parameter and never
 * read the system clock"). */
export function buildToday(kind: string | undefined, now: Date): Date {
  return kind === 'fixture' ? FIXTURE_TODAY : now;
}
