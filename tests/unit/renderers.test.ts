// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { TICK_PATH } from '../../src/lib/brush-tick';
import { el, svgEl, tick } from '../../src/lib/dom';
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

// Mutation testing (Task 11): exact markup, so a dropped class, attribute,
// label or link, or a changed number, fails a test instead of surviving.
const TICK = (w: number, h: number) =>
  `<svg viewBox="0 0 36 30" width="${w}" height="${h}" class="tick" aria-hidden="true"><path d="${TICK_PATH}" class="tick-ink"></path></svg>`;
const html = (render: (l: HTMLElement) => void) => { const l = live(); render(l); return l.innerHTML; };

test('@REQ-QUAL-01 verdict markup: classes, deploy time and every link', () => {
  expect(html((l) => renderVerdict(l, fixture('valid')))).toBe(
    '<p class="lede">Every promise this site makes is tied to the checks that prove it. This build covered <b>all 4 requirements</b> with <b>148 tests</b> (<b>312 test runs</b>), and nothing ships unless every one passes.</p>'
    + '<p class="meta2">Deployed 27 September 2026, 09:14 UTC<br>'
    + 'Commit <a href="https://github.com/example/ceylan-akyol-site/commit/e5cdb92a1b2c3d4e5f60718293a4b5c6d7e8f901" class="lnk">e5cdb92</a><br>'
    + '<a href="https://github.com/example/ceylan-akyol-site/actions/runs/1" class="lnk">View this CI run</a><br>'
    + '<a href="https://github.com/example/ceylan-akyol-site" class="lnk">Browse the source</a></p>',
  );
});
test('@REQ-QUAL-01 verdict uses singular forms for counts of one', () => {
  const d = fixture('valid');
  const l = live(); renderVerdict(l, { ...d, counts: { ...d.counts, requirements: 1, tests: 1, testRuns: 1 } });
  expect(squash(l.querySelector('.lede')!.textContent)).toContain('covered all 1 requirement with 1 test (1 test run), and');
});
test('@REQ-QUAL-01 integrity markup for a verified, a single-file and a failed live check', () => {
  const d = fixture('valid');
  expect(html((l) => renderIntegrity(l, d))).toBe(
    `<p class="integrity">${TICK(22, 18)}The previous deploy was verified live: every file served matched the tested build (64 files, checked 26 September 2026, 09:20 UTC).</p>`,
  );
  expect(squash(html((l) => renderIntegrity(l, { ...d, liveCheck: { ...d.liveCheck!, files: 1 } })))).toContain('(1 file, checked');
  expect(html((l) => renderIntegrity(l, { ...d, liveCheck: { ...d.liveCheck!, ok: false } }))).toBe(
    '<p class="integrity">The previous deploy\'s live check found files that did not match the tested build. '
    + '<a href="https://github.com/example/ceylan-akyol-site/actions" class="lnk">See the CI history</a></p>',
  );
});
test('@REQ-QUAL-01 matrix markup for tested, check-only and post-deploy rows', () => {
  const tick = TICK(30, 25);
  const blob = 'https://github.com/example/ceylan-akyol-site/blob/e5cdb92a1b2c3d4e5f60718293a4b5c6d7e8f901';
  expect(html((l) => renderMatrix(l, fixture('valid')))).toBe(
    '<ul class="reqs">'
    + `<li class="req">${tick}<div><span class="rq-id">REQ-CV-01</span><p class="rq-text">CV downloads in one click from the hero</p></div>`
    + '<div class="rq-cov"><strong>1 test</strong><span>e2e</span><span class="dim">5 device profiles</span>'
    + `<details><summary>Show the test</summary><ul><li><a href="${blob}/tests/e2e/home.spec.ts#L12" class="lnk">hero CV link returns a PDF</a></li></ul></details></div></li>`
    + `<li class="req">${tick}<div><span class="rq-id">REQ-CERT-03</span><p class="rq-text">Expired only when expiry is strictly before today</p></div>`
    + '<div class="rq-cov"><strong>1 test</strong><span>unit</span>'
    + `<details><summary>Show the test</summary><ul><li><a href="${blob}/tests/unit/certifications.test.ts#L27" class="lnk">expiring today is still valid</a></li></ul></details></div></li>`
    + `<li class="req">${tick}<div><span class="rq-id">REQ-PERF-01</span><p class="rq-text">Mobile Lighthouse in CI: performance at least 95</p></div>`
    + '<div class="rq-cov"><strong>Lighthouse CI</strong></div></li>'
    + `<li class="req">${tick}<div><span class="rq-id">REQ-DEPLOY-01</span><p class="rq-text">Every file served live matches the tested build</p></div>`
    + '<div class="rq-cov"><strong>Checked after each deploy</strong><span>live smoke test</span></div></li>'
    + '</ul>',
  );
});
test('@REQ-QUAL-01 matrix coverage joins several tests, suites and checks, and counts one device profile', () => {
  const d = fixture('valid');
  const t = (title: string, suite: 'unit' | 'e2e', projects: string[]) => ({ title, file: 'tests/x.ts', line: 1, suite, projects });
  const rows: QualityReport['matrix'] = [
    { id: 'REQ-A-01', text: 'a', phase: 'pre-deploy', checks: ['links'],
      tests: [t('one', 'e2e', ['chromium']), t('two', 'e2e', ['chromium']), t('three', 'unit', [])] },
    { id: 'REQ-B-01', text: 'b', phase: 'pre-deploy', checks: ['lighthouse', 'dist-scan'], tests: [] },
  ];
  const l = live(); renderMatrix(l, { ...d, matrix: rows });
  const [a, b] = [...l.querySelectorAll('.rq-cov')];
  expect(a!.innerHTML.replace(/<ul>.*<\/ul>/, '<ul></ul>')).toBe(
    '<strong>3 tests, link check</strong><span>e2e, unit</span><span class="dim">1 device profile</span><details><summary>Show the 3 tests</summary><ul></ul></details>',
  );
  expect(a!.querySelectorAll('li')).toHaveLength(3);
  expect(b!.innerHTML).toBe('<strong>Lighthouse CI, built HTML scan</strong>');
});
const trendHistory = (runs: number[], mutation: number[], lighthouse: number[]): QualityReport['history'] =>
  runs.map((r, i) => ({ commit: `c${i}00000`, date: `2026-09-2${i}T09:00:00Z`, testRuns: r, mutationScore: mutation[i]!, lighthousePerformance: lighthouse[i]! }));
test('@REQ-STATE-01 trends markup with exactly 3 points: labels, current values and line coordinates', () => {
  const d = fixture('valid');
  const trend = (label: string, now: string, points: string, cap: string) =>
    `<div class="trend"><h3>${label}</h3><p class="now">${now}</p><svg viewBox="0 0 220 56" class="spark" aria-hidden="true">`
    + `<polyline points="${points}" class="spark-line" fill="none"></polyline></svg><p class="cap">${cap}</p></div>`;
  // x runs from 8 to 212; y maps the lowest value to 48 and the top of the
  // range to 8. The range top is the series maximum, or 100 for percentages.
  expect(html((l) => renderTrends(l, { ...d, history: trendHistory([1000, 1500, 2000], [80, 85, 90], [96, 98, 100]) }))).toBe(
    '<div class="trends">'
    + trend('Test runs passed', '2,000', '8.0,48.0 110.0,28.0 212.0,8.0', 'Across 5 device profiles')
    + trend('Mutation score', '90%', '8.0,48.0 110.0,38.0 212.0,28.0', 'Share of planted bugs the tests caught')
    + trend('Lighthouse mobile score', '100', '8.0,48.0 110.0,28.0 212.0,8.0', 'Median of 3 runs in CI')
    + '</div>',
  );
});
test('@REQ-STATE-01 a flat trend draws a level line at the bottom, not NaN', () => {
  const l = live(); renderTrends(l, { ...fixture('valid'), history: trendHistory([300, 300, 300], [100, 100, 100], [100, 100, 100]) });
  expect([...l.querySelectorAll('polyline')].map((p) => p.getAttribute('points'))).toEqual([
    '8.0,48.0 110.0,48.0 212.0,48.0', '8.0,48.0 110.0,48.0 212.0,48.0', '8.0,48.0 110.0,48.0 212.0,48.0',
  ]);
});
test('@REQ-STATE-01 sparse trends message markup', () => {
  const d = fixture('valid');
  expect(html((l) => renderTrends(l, { ...d, history: d.history.slice(0, 2) }))).toBe(
    '<p class="sparse">Trends appear after 3 deploys. This is deploy 2.</p>',
  );
});
test('@REQ-QUAL-01 mutation markup links the dashboard report, and says time for one', () => {
  const d = fixture('valid');
  expect(html((l) => renderMutation(l, d))).toBe(
    '<p>Stryker changed the business logic 86 times to plant deliberate bugs. The tests caught 86.</p>'
    + `<p><a href="${d.mutation.reportUrl}" class="lnk">Open the full report on Stryker Dashboard</a></p>`,
  );
  const { reportUrl: _drop, ...m } = d.mutation;
  expect(html((l) => renderMutation(l, { ...d, mutation: { ...m, total: 1, killed: 1 } }))).toBe(
    '<p>Stryker changed the business logic 1 time to plant deliberate bugs. The tests caught 1.</p>',
  );
});
test('@REQ-QUAL-01 proof strip markup, with singular forms for counts of one', () => {
  const d = fixture('valid');
  expect(html((l) => renderProofStrip(l, { ...d, counts: { ...d.counts, testRuns: 1, axeViolations: 1 } }))).toBe(
    '<p class="big">This site\'s code passed <b>1 test run</b> across 3 browser engines and 5 device profiles, with <b>1 automated accessibility violation</b> (axe) and a Lighthouse mobile score of <b>100</b> in CI.</p>',
  );
});
test('@REQ-SEC-02 el keeps only allowlisted attributes and adds lnk to an anchor\'s own class', () => {
  const div = el('div', 'x', { class: 'c', id: 'i', onclick: 'alert(1)', style: 'color:red', 'aria-label': 'l' });
  expect(div.outerHTML).toBe('<div class="c" aria-label="l">x</div>');
  expect(el('p', 'y', { class: 'lede' }).outerHTML).toBe('<p class="lede">y</p>');
  expect(el('a', 'z', { class: 'big', href: '/x' }).outerHTML).toBe('<a class="big lnk" href="/x">z</a>');
});
test('@REQ-SEC-02 svgEl drops style attributes and keeps the rest', () => {
  const svg = svgEl('svg', { style: 'fill:red', class: 's', viewBox: '0 0 1 1' });
  expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
  expect(svg.outerHTML).toBe('<svg class="s" viewBox="0 0 1 1"></svg>');
});
test('@REQ-QUAL-01 tick is the brush path scaled to the requested width', () => {
  expect(tick().outerHTML).toBe(TICK(30, 25));
  expect(tick(36).outerHTML).toBe(TICK(36, 30));
  expect(tick(22).outerHTML).toBe(TICK(22, 18));
});
test('@REQ-SEC-02 el keeps the datetime, aria-hidden and hidden attributes', () => {
  expect(el('time', '2026', { datetime: '2026-09-27' }).outerHTML).toBe('<time datetime="2026-09-27">2026</time>');
  expect(el('span', 'x', { 'aria-hidden': 'true', hidden: '' }).outerHTML).toBe('<span aria-hidden="true" hidden="">x</span>');
});
