import { readFileSync } from 'node:fs';
import { parseQualityReport, LIMITS, SCHEMA_VERSION } from '../../src/lib/quality-schema';

const load = (name: string) => JSON.parse(readFileSync(`tests/fixtures/quality/${name}.json`, 'utf8'));
const valid = () => load('valid');

test('@REQ-QUAL-02 the valid fixture parses', () => {
  const r = parseQualityReport(valid());
  expect(r.ok).toBe(true);
  expect(SCHEMA_VERSION).toBe(1);
});

test('@REQ-QUAL-02 a future schema version is rejected, not thrown', () => {
  expect(parseQualityReport(load('future')).ok).toBe(false);
});

test('@REQ-QUAL-02 wrong types are rejected', () => {
  const doc = valid();
  doc.counts.testRuns = '312';
  expect(parseQualityReport(doc).ok).toBe(false);
});

test('@REQ-QUAL-02 negative and fractional counts are rejected', () => {
  const a = valid(); a.counts.tests = -1;
  const b = valid(); b.counts.tests = 1.5;
  expect(parseQualityReport(a).ok).toBe(false);
  expect(parseQualityReport(b).ok).toBe(false);
});

test('@REQ-QUAL-02 scores above 100 are rejected', () => {
  const doc = valid(); doc.lighthouse.performance = 101;
  expect(parseQualityReport(doc).ok).toBe(false);
});

test('@REQ-QUAL-02 too many requirements are rejected', () => {
  const doc = valid();
  doc.matrix = Array.from({ length: LIMITS.requirements + 1 }, (_, i) => ({
    ...doc.matrix[0], id: `REQ-X-${String(i % 100).padStart(2, '0')}`,
  }));
  expect(parseQualityReport(doc).ok).toBe(false);
});

test('@REQ-QUAL-02 too many history points are rejected', () => {
  const doc = valid();
  doc.history = Array.from({ length: LIMITS.history + 1 }, () => doc.history[0]);
  expect(parseQualityReport(doc).ok).toBe(false);
});

test('@REQ-QUAL-02 too many covering tests on one requirement are rejected', () => {
  const doc = valid();
  doc.matrix[0].tests = Array.from(
    { length: LIMITS.testsPerRequirement + 1 },
    () => doc.matrix[0].tests[0],
  );
  expect(parseQualityReport(doc).ok).toBe(false);
});

test('@REQ-QUAL-02 overlong strings are rejected', () => {
  const doc = valid(); doc.matrix[0].text = 'x'.repeat(LIMITS.string + 1);
  expect(parseQualityReport(doc).ok).toBe(false);
});

test('@REQ-QUAL-02 non-https links are rejected', () => {
  const doc = valid(); doc.ciRunUrl = 'javascript:alert(1)';
  expect(parseQualityReport(doc).ok).toBe(false);
});

test('@REQ-QUAL-02 the report URL is optional', () => {
  const doc = valid(); delete doc.mutation.reportUrl; delete doc.liveCheck;
  expect(parseQualityReport(doc).ok).toBe(true);
});

test('@REQ-QUAL-02 non-objects are rejected', () => {
  for (const x of [null, 42, 'x', [], undefined]) expect(parseQualityReport(x).ok).toBe(false);
});

// Controller ruling P11: spec section 8 requires the hostile fixture (HTML in
// names, huge and negative numbers, wrong types) to fail parsing and settle
// unavailable. hostile-valid.json keeps only the brief's HTML and javascript:
// string changes plus counts.testRuns 999999, and stays schema-valid so later
// tasks can prove rendered strings cannot inject markup (REQ-SEC-02) while the
// data settles ready.
test('@REQ-QUAL-02 the hostile fixture (huge and negative numbers, wrong types) is rejected', () => {
  expect(parseQualityReport(load('hostile')).ok).toBe(false);
});

test('@REQ-QUAL-02 the hostile-valid fixture (HTML in names, javascript: link) still parses', () => {
  expect(parseQualityReport(load('hostile-valid')).ok).toBe(true);
});

// Mutation testing (Task 11).
test('@REQ-QUAL-02 the rejection reason names the first failing field, or root', () => {
  const doc = valid();
  doc.counts.testRuns = '312';
  expect(parseQualityReport(doc)).toEqual({ ok: false, reason: 'counts.testRuns' });
  expect(parseQualityReport(42)).toEqual({ ok: false, reason: 'root' });
});
test('@REQ-QUAL-02 commit SHAs, dates and requirement ids are anchored at both ends', () => {
  const withCommit = (commit: string) => { const doc = valid(); doc.commit = commit; return parseQualityReport(doc).ok; };
  expect(withCommit('e5cdb92')).toBe(true);
  expect(withCommit('zze5cdb92')).toBe(false);
  expect(withCommit('e5cdb92zz')).toBe(false);
  const withDate = (builtAt: string) => { const doc = valid(); doc.builtAt = builtAt; return parseQualityReport(doc).ok; };
  expect(withDate('x2026-09-27T09:14:00Z')).toBe(false);
  expect(withDate('2026-09-27T09:1')).toBe(false);
  const withId = (id: string) => { const doc = valid(); doc.matrix[0].id = id; return parseQualityReport(doc).ok; };
  expect(withId('xREQ-CV-01')).toBe(false);
  expect(withId('REQ-CV-01x')).toBe(false);
});
test('@REQ-QUAL-02 history points are validated and kept field for field', () => {
  const doc = valid();
  const r = parseQualityReport(doc);
  expect(r.ok && r.data.history[0]).toEqual(doc.history[0]);
  doc.history[0].testRuns = 'many';
  expect(parseQualityReport(doc)).toEqual({ ok: false, reason: 'history.0.testRuns' });
});
