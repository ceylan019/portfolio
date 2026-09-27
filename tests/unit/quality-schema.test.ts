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
