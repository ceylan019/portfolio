// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { el } from '../../src/lib/dom';
import { parseQualityReport, type QualityReport } from '../../src/lib/quality-schema';
import { renderProofStrip } from '../../src/lib/render-home';
import {
  formatDeployTime, plural, renderDuration, renderIntegrity, renderMatrix, renderMutation, renderTrends, renderVerdict,
} from '../../src/lib/render-quality';

const fixture = (name: string): QualityReport => {
  const r = parseQualityReport(JSON.parse(readFileSync(`tests/fixtures/quality/${name}.json`, 'utf8')));
  if (!r.ok) throw new Error(r.reason);
  return r.data;
};
const live = () => document.createElement('div');
const squash = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

test('@REQ-QUAL-01 proof strip sentence uses the exact approved wording', () => {
  const l = live(); renderProofStrip(l, fixture('valid'));
  expect(squash(l.textContent)).toBe("This site's code passed 312 test runs across 3 browser engines and 5 device profiles, with 0 automated accessibility violations (axe) and a Lighthouse mobile score of 100 in CI.");
  expect(l.querySelectorAll('b')).toHaveLength(3);
});
test('@REQ-QUAL-01 plurals and thousands separators', () => {
  expect(plural(1, 'test run', 'test runs')).toBe('1 test run');
  expect(plural(1234, 'test run', 'test runs')).toBe('1,234 test runs');
});
test('@REQ-QUAL-01 verdict states requirements, tests and test runs', () => {
  const l = live(); renderVerdict(l, fixture('valid'));
  expect(squash(l.textContent)).toContain('This build covered all 4 requirements with 148 tests (312 test runs), and nothing ships unless every one passes.');
  const commit = l.querySelector('a[href*="/commit/"]')!;
  expect(commit.getAttribute('href')).toBe('https://github.com/example/ceylan-akyol-site/commit/e5cdb92a1b2c3d4e5f60718293a4b5c6d7e8f901');
  expect(commit.textContent).toBe('e5cdb92');
});
test('@REQ-QUAL-01 deploy time reads as day month year, UTC', () => {
  expect(formatDeployTime('2026-09-27T09:14:00Z')).toBe('27 September 2026, 09:14 UTC');
});
test('@REQ-QUAL-01 matrix rows link covering tests to permalinks at the deployed commit', () => {
  const l = live(); renderMatrix(l, fixture('valid'));
  expect(l.querySelectorAll('li.req')).toHaveLength(4);
  const link = l.querySelector('a[href*="/blob/"]')!;
  expect(link.getAttribute('href')).toBe('https://github.com/example/ceylan-akyol-site/blob/e5cdb92a1b2c3d4e5f60718293a4b5c6d7e8f901/tests/e2e/home.spec.ts#L12');
  expect(squash(l.textContent)).toContain('Lighthouse CI');
  expect(squash(l.textContent)).toContain('Checked after each deploy');
});
test('@REQ-QUAL-01 every anchor a renderer creates carries class lnk', () => {
  const l = live(); renderVerdict(l, fixture('valid'));
  const anchors = [...l.querySelectorAll('a')];
  expect(anchors.length).toBeGreaterThan(0);
  for (const a of anchors) expect(a.classList.contains('lnk')).toBe(true);
});
test('@REQ-SEC-02 el rejects javascript, data and protocol-relative hrefs', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,x', '//evil.example', '/\\evil.example']) {
    expect(el('a', 'x', { href }).hasAttribute('href')).toBe(false);
  }
  for (const href of ['https://example.com', '/quality']) {
    expect(el('a', 'x', { href }).getAttribute('href')).toBe(href);
  }
});
test('@REQ-SEC-02 hostile strings render as text and create no elements', () => {
  // T10-A: hostile.json is now schema-invalid, so this test exercises the
  // schema-valid hostile-valid fixture, whose HTML and javascript: strings
  // still reach the renderer.
  const l = live(); document.body.append(l);
  renderMatrix(l, fixture('hostile-valid'));
  expect(l.querySelector('img, script')).toBeNull();
  expect(l.textContent).toContain('<img src=x');
  expect(document.body.dataset.pwned).toBeUndefined();
  for (const a of l.querySelectorAll('a')) expect(a.getAttribute('href')!.startsWith('https://')).toBe(true);
});
test('@REQ-QUAL-01 integrity line covers ok, failed and first-deploy cases', () => {
  const d = fixture('valid');
  const ok = live(); renderIntegrity(ok, d);
  expect(squash(ok.textContent)).toBe('The previous deploy was verified live: every file served matched the tested build (64 files, checked 26 September 2026, 09:20 UTC).');
  const bad = live(); renderIntegrity(bad, { ...d, liveCheck: { ...d.liveCheck!, ok: false } });
  expect(squash(bad.textContent)).toContain('found files that did not match');
  const first = live(); const { liveCheck: _omit, ...rest } = d; renderIntegrity(first, rest as QualityReport);
  expect(squash(first.textContent)).toBe('The live file check runs after this deploy.');
});
test('@REQ-STATE-01 trends show lines with 3 or more points and a message below that', () => {
  const d = fixture('valid');
  const full = live(); renderTrends(full, d);
  expect(full.querySelectorAll('polyline')).toHaveLength(3);
  expect(squash(full.textContent)).toContain('Lighthouse mobile score');
  const sparse = live(); renderTrends(sparse, { ...d, history: d.history.slice(0, 2) });
  expect(squash(sparse.textContent)).toBe('Trends appear after 3 deploys. This is deploy 2.');
  expect(sparse.querySelector('polyline')).toBeNull();
});
test('@REQ-QUAL-01 mutation sentence, with the dashboard link only when uploaded', () => {
  const d = fixture('valid');
  const withLink = live(); renderMutation(withLink, d);
  expect(squash(withLink.textContent)).toContain('Stryker changed the business logic 86 times to plant deliberate bugs. The tests caught 86.');
  expect(withLink.querySelector('a')).not.toBeNull();
  const { reportUrl: _drop, ...m } = d.mutation;
  const noLink = live(); renderMutation(noLink, { ...d, mutation: m });
  expect(noLink.querySelector('a')).toBeNull();
});
test('@REQ-QUAL-01 pipeline duration in minutes and seconds', () => {
  const l = live(); renderDuration(l, fixture('valid'));
  expect(squash(l.textContent)).toBe('This build went through the pipeline in 8 min 32 s.');
});
