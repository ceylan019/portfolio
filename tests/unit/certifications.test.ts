import { formatMonthYear, utcDay } from '../../src/lib/dates';
import {
  type Certification, isExpired, validity, validityLabel,
  visibleCertifications, hasVerification, showTickNote,
} from '../../src/lib/certifications';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const cert = (over: Partial<Certification>): Certification => ({
  id: 'x', name: 'Cert', issuer: 'ISTQB', issueDate: d('2024-03-01'), ...over,
});

describe('dates', () => {
  test('@REQ-CERT-05 formats month and year in English, UTC', () => {
    expect(formatMonthYear(d('2024-03-01'))).toBe('March 2024');
    expect(formatMonthYear(new Date('2024-12-31T23:30:00-05:00'))).toBe('January 2025');
  });
  test('@REQ-CERT-03 utcDay drops the time of day', () => {
    expect(utcDay(new Date('2024-03-05T23:59:59Z'))).toBe(utcDay(d('2024-03-05')));
  });
});

describe('expiry', () => {
  const today = d('2026-09-27');
  test('@REQ-CERT-03 expiring today is still valid', () => {
    expect(isExpired(cert({ expiryDate: d('2026-09-27') }), today)).toBe(false);
  });
  test('@REQ-CERT-03 expired the day before is expired', () => {
    expect(isExpired(cert({ expiryDate: d('2026-09-26') }), today)).toBe(true);
  });
  test('@REQ-CERT-03 no expiry date never expires', () => {
    expect(isExpired(cert({}), today)).toBe(false);
  });
  test('@REQ-CERT-03 compares UTC calendar days even late in a negative offset evening', () => {
    const lateEvening = new Date('2026-09-27T23:30:00-05:00'); // 04:30 UTC on the 28th
    expect(isExpired(cert({ expiryDate: d('2026-09-27') }), lateEvening)).toBe(true);
    expect(isExpired(cert({ expiryDate: d('2026-09-28') }), lateEvening)).toBe(false);
  });
});

describe('validity labels', () => {
  const today = d('2026-09-27');
  test('@REQ-CERT-05 valid until', () => {
    const v = validity(cert({ expiryDate: d('2027-03-01') }), today);
    expect(v).toEqual({ kind: 'valid', until: d('2027-03-01') });
    expect(validityLabel(v)).toBe('Valid until March 2027');
  });
  test('@REQ-CERT-05 expired', () => {
    const v = validity(cert({ expiryDate: d('2024-01-15') }), today);
    expect(validityLabel(v)).toBe('Expired January 2024');
  });
  test('@REQ-CERT-05 no label without an expiry date', () => {
    expect(validityLabel(validity(cert({}), today))).toBeNull();
  });
});

describe('visible certifications', () => {
  test('@REQ-CERT-02 hidden entries are removed', () => {
    const list = [cert({ id: 'a' }), cert({ id: 'b', hidden: true })];
    expect(visibleCertifications(list).map((c) => c.id)).toEqual(['a']);
  });
  test('@REQ-CERT-01 newest first', () => {
    const list = [
      cert({ id: 'old', issueDate: d('2021-01-01') }),
      cert({ id: 'new', issueDate: d('2024-11-01') }),
      cert({ id: 'mid', issueDate: d('2024-03-01') }),
    ];
    expect(visibleCertifications(list).map((c) => c.id)).toEqual(['new', 'mid', 'old']);
  });
  test('@REQ-CERT-01 same issue date sorts by name A to Z, independent of input order', () => {
    const a = cert({ id: 'b', name: 'Beta' });
    const b = cert({ id: 'a', name: 'Alpha' });
    expect(visibleCertifications([a, b]).map((c) => c.id)).toEqual(['a', 'b']);
    expect(visibleCertifications([b, a]).map((c) => c.id)).toEqual(['a', 'b']);
  });
  test('@REQ-CERT-01 does not mutate the input', () => {
    const list = [cert({ id: 'x', issueDate: d('2020-01-01') }), cert({ id: 'y' })];
    visibleCertifications(list);
    expect(list.map((c) => c.id)).toEqual(['x', 'y']);
  });
});

describe('ticks', () => {
  test('@REQ-CERT-04 verification only with a verify URL', () => {
    expect(hasVerification(cert({ verifyUrl: 'https://verify.example/1' }))).toBe(true);
    expect(hasVerification(cert({}))).toBe(false);
    expect(hasVerification(cert({ verifyUrl: '' }))).toBe(false);
  });
  test('@REQ-CERT-06 tick note only when at least one visible entry is verifiable', () => {
    expect(showTickNote([cert({}), cert({ verifyUrl: 'https://v.example' })])).toBe(true);
    expect(showTickNote([cert({})])).toBe(false);
    expect(showTickNote([cert({ verifyUrl: 'https://v.example', hidden: true })])).toBe(false);
    expect(showTickNote([])).toBe(false);
  });
});

// Mutation testing (Task 11).
test('@REQ-CERT-05 a certification without an expiry date has validity none', () => {
  expect(validity(cert({}), d('2026-09-27'))).toEqual({ kind: 'none' });
});
