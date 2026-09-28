import { combineEvidence, distScanEvidence, lighthouseEvidence, linksEvidence, medianScores } from '../../src/lib/evidence';

const urls = ['http://localhost:8788/', 'http://localhost:8788/quality'];
const lhrs = (n: number) => urls.flatMap((u) => Array.from({ length: n }, () => ({ requestedUrl: u })));

test('@REQ-TRACE-01 lighthouse passes with every URL run 3 times and no error assertions', () => {
  const e = lighthouseEvidence({ lhrs: lhrs(3), assertions: [], expectedUrls: urls, runsPerUrl: 3 });
  expect(e).toMatchObject({ name: 'lighthouse', passed: true, examined: 6 });
  expect(e.detail).toBe('6 runs');
});
test('@REQ-TRACE-01 lighthouse fails when a URL has fewer runs', () => {
  const e = lighthouseEvidence({ lhrs: lhrs(3).slice(1), assertions: [], expectedUrls: urls, runsPerUrl: 3 });
  expect(e.passed).toBe(false);
  expect(e.detail).toBe('Too few Lighthouse runs for: http://localhost:8788/');
});
test('@REQ-TRACE-01 lighthouse fails on a failed error-level assertion, not on warnings', () => {
  const base = { lhrs: lhrs(3), expectedUrls: urls, runsPerUrl: 3 };
  expect(lighthouseEvidence({ ...base, assertions: [{ level: 'warn', passed: false }] }).passed).toBe(true);
  const e = lighthouseEvidence({ ...base, assertions: [{ level: 'error', passed: false }] });
  expect(e.passed).toBe(false);
  expect(e.detail).toBe('1 Lighthouse assertion(s) failed');
});
test('@REQ-TRACE-01 lighthouse with no reports examined nothing', () => {
  expect(lighthouseEvidence({ lhrs: [], assertions: [], expectedUrls: urls, runsPerUrl: 3 })).toMatchObject({ passed: false, examined: 0 });
});

test('@REQ-TRACE-01 links need a passing report with at least one checked link', () => {
  const ok = linksEvidence({ passed: true, links: [{ state: 'OK' }, { state: 'SKIPPED' }] });
  expect(ok).toMatchObject({ passed: true, examined: 1 });
  expect(ok.detail).toBe('1 links checked');
  expect(linksEvidence({ passed: true, links: [{ state: 'SKIPPED' }] })).toMatchObject({ passed: false, examined: 0 });
  expect(linksEvidence({ passed: false, links: [{ state: 'BROKEN' }] }).passed).toBe(false);
  expect(linksEvidence('garbage')).toMatchObject({ passed: false, examined: 0 });
});

test('@REQ-TRACE-01 dist scan must include index.html and have no findings', () => {
  const ok = distScanEvidence({ scanned: ['index.html', 'quality.html'], findings: [] });
  expect(ok).toMatchObject({ passed: true, examined: 2 });
  expect(ok.detail).toBe('2 HTML files, 0 findings');
  expect(distScanEvidence({ scanned: ['quality.html'], findings: [] }).passed).toBe(false);
  expect(distScanEvidence({ scanned: ['index.html'], findings: [{}] }).passed).toBe(false);
});
test('@REQ-TRACE-01 dist scan also accepts index.html nested under a subdirectory', () => {
  expect(distScanEvidence({ scanned: ['assets/index.html'], findings: [] }).passed).toBe(true);
});

test('@REQ-TRACE-01 combined evidence needs every part to pass', () => {
  const ok = { name: 'dist-scan' as const, passed: true, examined: 2, detail: 'a' };
  expect(combineEvidence([ok, ok])).toEqual({ name: 'dist-scan', passed: true, examined: 4, detail: 'a; a' });
  expect(combineEvidence([ok, { ...ok, passed: false }]).passed).toBe(false);
  expect(combineEvidence([])).toEqual({ name: 'dist-scan', passed: false, examined: 0, detail: 'no evidence' });
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

test('@REQ-TRACE-01 median scores only consider runs for the given URL', () => {
  const lhr = (url: string, p: number) => ({ requestedUrl: url, categories: {
    performance: { score: p }, accessibility: { score: 1 }, 'best-practices': { score: 1 }, seo: { score: 1 },
  } });
  const mixed = [
    lhr(urls[0]!, 0.5), lhr(urls[0]!, 0.7), lhr(urls[0]!, 0.9),
    lhr(urls[1]!, 0.1), lhr(urls[1]!, 0.2),
  ];
  expect(medianScores(mixed, urls[0]!).performance).toBe(70);
  expect(medianScores(mixed, urls[1]!).performance).toBe(10);
});
