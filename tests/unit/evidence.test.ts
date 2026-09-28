import { combineEvidence, distScanEvidence, lighthouseEvidence, linksEvidence, medianScores } from '../../src/lib/evidence';

const urls = ['http://localhost:8788/', 'http://localhost:8788/quality'];
const lhrs = (n: number) => urls.flatMap((u) => Array.from({ length: n }, () => ({ requestedUrl: u })));

test('@REQ-TRACE-01 lighthouse passes with every URL run 3 times and no error assertions', () => {
  expect(lighthouseEvidence({ lhrs: lhrs(3), assertions: [], expectedUrls: urls, runsPerUrl: 3 }))
    .toMatchObject({ name: 'lighthouse', passed: true, examined: 6 });
});
test('@REQ-TRACE-01 lighthouse fails when a URL has fewer runs', () => {
  const e = lighthouseEvidence({ lhrs: lhrs(3).slice(1), assertions: [], expectedUrls: urls, runsPerUrl: 3 });
  expect(e.passed).toBe(false);
  expect(e.detail).toContain('http://localhost:8788/');
});
test('@REQ-TRACE-01 lighthouse fails on a failed error-level assertion, not on warnings', () => {
  const base = { lhrs: lhrs(3), expectedUrls: urls, runsPerUrl: 3 };
  expect(lighthouseEvidence({ ...base, assertions: [{ level: 'warn', passed: false }] }).passed).toBe(true);
  expect(lighthouseEvidence({ ...base, assertions: [{ level: 'error', passed: false }] }).passed).toBe(false);
});
test('@REQ-TRACE-01 lighthouse with no reports examined nothing', () => {
  expect(lighthouseEvidence({ lhrs: [], assertions: [], expectedUrls: urls, runsPerUrl: 3 })).toMatchObject({ passed: false, examined: 0 });
});

test('@REQ-TRACE-01 links need a passing report with at least one checked link', () => {
  expect(linksEvidence({ passed: true, links: [{ state: 'OK' }, { state: 'SKIPPED' }] })).toMatchObject({ passed: true, examined: 1 });
  expect(linksEvidence({ passed: true, links: [{ state: 'SKIPPED' }] })).toMatchObject({ passed: false, examined: 0 });
  expect(linksEvidence({ passed: false, links: [{ state: 'BROKEN' }] }).passed).toBe(false);
  expect(linksEvidence('garbage')).toMatchObject({ passed: false, examined: 0 });
});

test('@REQ-TRACE-01 dist scan must include index.html and have no findings', () => {
  expect(distScanEvidence({ scanned: ['index.html', 'quality.html'], findings: [] })).toMatchObject({ passed: true, examined: 2 });
  expect(distScanEvidence({ scanned: ['quality.html'], findings: [] }).passed).toBe(false);
  expect(distScanEvidence({ scanned: ['index.html'], findings: [{}] }).passed).toBe(false);
});

test('@REQ-TRACE-01 combined evidence needs every part to pass', () => {
  const ok = { name: 'dist-scan' as const, passed: true, examined: 2, detail: 'a' };
  expect(combineEvidence([ok, ok])).toMatchObject({ passed: true, examined: 4 });
  expect(combineEvidence([ok, { ...ok, passed: false }]).passed).toBe(false);
  expect(combineEvidence([]).passed).toBe(false);
});

// P3: this is a unit test of the Lighthouse summarizer, not of the
// Lighthouse pipeline itself. It is tagged REQ-TRACE-01 rather than
// REQ-PERF-01 so REQ-PERF-01 is covered only by its declared lighthouse
// check (spec section 8); otherwise a missing Lighthouse report would never
// block the gate.
test('@REQ-TRACE-01 median scores per category, scaled to 0 to 100', () => {
  const lhr = (p: number) => ({ requestedUrl: urls[0]!, categories: {
    performance: { score: p }, accessibility: { score: 1 }, 'best-practices': { score: 1 }, seo: { score: null },
  } });
  expect(medianScores([lhr(0.91), lhr(0.99), lhr(0.95)], urls[0]!)).toEqual({ performance: 95, accessibility: 100, bestPractices: 100, seo: 0 });
});
