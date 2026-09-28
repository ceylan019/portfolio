import { FIXTURE_TODAY, buildToday } from '../../src/lib/build-date';

test('@REQ-CERT-03 FIXTURE_TODAY is pinned to 2026-09-27T00:00:00Z', () => {
  expect(FIXTURE_TODAY.toISOString()).toBe('2026-09-27T00:00:00.000Z');
});

test('@REQ-CERT-03 a fixture build always gets the fixed fixture today', () => {
  const now = new Date('2030-06-15T12:00:00Z');
  expect(buildToday('fixture', now)).toEqual(FIXTURE_TODAY);
});

test('@REQ-CERT-03 a real build gets the real clock unchanged', () => {
  const now = new Date('2030-06-15T12:00:00Z');
  expect(buildToday('real', now)).toBe(now);
});

test('@REQ-CERT-03 an undefined kind also gets the real clock, never the fixture date', () => {
  const now = new Date('2030-06-15T12:00:00Z');
  expect(buildToday(undefined, now)).toBe(now);
});
