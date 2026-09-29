import type { Renderer } from './quality-client';
import { FIXTURE_PROJECTS, REAL_PROJECT, type MatrixRow, type QualityReport } from './quality-schema';
import { el, svgEl, tick } from './dom';
import { MONTHS } from './dates';
import { plural } from './format';

const nf = new Intl.NumberFormat('en-US');
const pad = (n: number) => String(n).padStart(2, '0');

export function formatDeployTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

const permalink = (d: QualityReport, file: string, line: number) =>
  `${d.repoUrl}/blob/${d.commit}/${file.split('/').map(encodeURIComponent).join('/')}#L${line}`;

export const renderVerdict: Renderer = (live, d) => {
  const p = el('p', undefined, { class: 'lede' });
  p.append(
    'Every promise this site makes is tied to the checks that prove it. This build covered ',
    // counts.requirements holds the pre-deploy requirements only: the post-deploy
    // live check runs after this build, so the build never covers it.
    el('b', `all ${plural(d.counts.requirements, 'pre-deploy requirement', 'pre-deploy requirements')}`),
    ' with ',
    el('b', plural(d.counts.tests, 'test', 'tests')),
    ' (', el('b', plural(d.counts.testRuns, 'test run', 'test runs')), '), and nothing ships unless every one passes.',
  );
  const meta = el('p', undefined, { class: 'meta2' });
  meta.append(
    `Deployed ${formatDeployTime(d.builtAt)}`, el('br'),
    'Commit ', el('a', d.commit.slice(0, 7), { href: `${d.repoUrl}/commit/${d.commit}` }), el('br'),
    el('a', 'View this CI run', { href: d.ciRunUrl }), el('br'),
    el('a', 'Browse the source', { href: d.repoUrl }),
  );
  live.append(p, meta);
};

export const renderIntegrity: Renderer = (live, d) => {
  const p = el('p', undefined, { class: 'integrity' });
  if (!d.liveCheck) {
    p.append('The live file check runs after this deploy.');
  } else if (d.liveCheck.ok) {
    p.append(
      tick(22),
      `The previous deploy was verified live: every file served matched the tested build (${plural(d.liveCheck.files, 'file', 'files')}, checked ${formatDeployTime(d.liveCheck.checkedAt)}).`,
    );
  } else {
    p.append("The previous deploy's live check found files that did not match the tested build. ", el('a', 'See the CI history', { href: `${d.repoUrl}/actions` }));
  }
  live.append(p);
};

const CHECK_LABELS = { lighthouse: 'Lighthouse CI', links: 'link check', 'dist-scan': 'built HTML scan' } as const;

// The post-deploy row reports the previous deploy's live check (spec section 8). The
// brush tick means "this was checked" (DESIGN.md), so it appears only when that check
// passed; otherwise the row says plainly where things stand.
function liveCheckStatus(d: QualityReport): string {
  if (!d.liveCheck) return 'Not verified yet';
  return d.liveCheck.ok ? 'Verified on the previous deploy' : 'Failed on the previous deploy';
}

const fixtureProjects: readonly string[] = FIXTURE_PROJECTS;

/** Device profiles are the 5 fixture projects only (E13); the real build's project is
 * named separately, so a row can never claim a sixth profile. */
function whereItRan(projects: string[]): string {
  const profiles = projects.filter((p) => fixtureProjects.includes(p)).length;
  const parts = [
    ...(profiles > 0 ? [`${profiles} device ${profiles === 1 ? 'profile' : 'profiles'}`] : []),
    ...(projects.includes(REAL_PROJECT) ? ['real build'] : []),
  ];
  return parts.join(', ');
}

function coverage(row: MatrixRow, d: QualityReport): HTMLElement {
  const box = el('div', undefined, { class: 'rq-cov' });
  if (row.phase === 'post-deploy') {
    box.append(el('strong', 'Checked after each deploy'), el('span', 'live smoke test'), el('span', liveCheckStatus(d), { class: 'dim' }));
    return box;
  }
  const suites = [...new Set(row.tests.map((t) => t.suite))];
  const where = whereItRan([...new Set(row.tests.flatMap((t) => t.projects))]);
  const parts = [...(row.tests.length > 0 ? [plural(row.tests.length, 'test', 'tests')] : []), ...row.checks.map((c) => CHECK_LABELS[c])];
  box.append(el('strong', parts.join(', ')));
  if (suites.length > 0) box.append(el('span', suites.join(', ')));
  if (where) box.append(el('span', where, { class: 'dim' }));
  if (row.tests.length > 0) {
    const details = el('details');
    details.append(el('summary', `Show ${row.tests.length === 1 ? 'the test' : `the ${row.tests.length} tests`}`));
    const list = el('ul');
    for (const t of row.tests) {
      const li = el('li');
      li.append(el('a', t.title, { href: permalink(d, t.file, t.line) }));
      list.append(li);
    }
    details.append(list);
    box.append(details);
  }
  return box;
}

export const renderMatrix: Renderer = (live, d) => {
  const list = el('ul', undefined, { class: 'reqs' });
  for (const row of d.matrix) {
    const li = el('li', undefined, { class: 'req' });
    const main = el('div');
    main.append(el('span', row.id, { class: 'rq-id' }), el('p', row.text, { class: 'rq-text' }));
    const checked = row.phase === 'pre-deploy' || d.liveCheck?.ok === true;
    // An unchecked row keeps an empty first cell, so the grid columns still line up.
    li.append(checked ? tick(30) : el('span'), main, coverage(row, d));
    list.append(li);
  }
  live.append(list);
};

const SERIES = [
  { key: 'testRuns', label: 'Test runs passed', caption: 'Across 5 device profiles', max: null },
  { key: 'mutationScore', label: 'Mutation score', caption: 'Share of planted bugs the tests caught', max: 100 },
  { key: 'lighthousePerformance', label: 'Lighthouse mobile score', caption: 'Median of 3 runs in CI', max: 100 },
] as const;

export const renderTrends: Renderer = (live, d) => {
  const h = d.history;
  if (h.length < 3) {
    live.append(el('p', `Trends appear after 3 deploys. This is deploy ${h.length}.`, { class: 'sparse' }));
    return;
  }
  const grid = el('div', undefined, { class: 'trends' });
  for (const s of SERIES) {
    const values = h.map((p) => p[s.key]);
    const lo = Math.min(...values);
    const hi = Math.max(...values, s.max ?? 0, lo + 1);
    const points = values.map((v, i) => `${(8 + (i * 204) / (values.length - 1)).toFixed(1)},${(48 - ((v - lo) / (hi - lo)) * 40).toFixed(1)}`).join(' ');
    const item = el('div', undefined, { class: 'trend' });
    const svg = svgEl('svg', { viewBox: '0 0 220 56', class: 'spark', 'aria-hidden': 'true' });
    svg.append(svgEl('polyline', { points, class: 'spark-line', fill: 'none' }));
    const current = values[values.length - 1]!;
    item.append(el('h3', s.label), el('p', s.max === 100 ? `${current}${s.key === 'mutationScore' ? '%' : ''}` : nf.format(current), { class: 'now' }), svg, el('p', s.caption, { class: 'cap' }));
    grid.append(item);
  }
  live.append(grid);
};

export const renderMutation: Renderer = (live, d) => {
  const p = el('p');
  p.append(`Stryker changed the business logic ${plural(d.mutation.total, 'time', 'times')} to plant deliberate bugs. The tests caught ${nf.format(d.mutation.killed)}.`);
  live.append(p);
  if (d.mutation.reportUrl) {
    const link = el('p');
    link.append(el('a', 'Open the full report on Stryker Dashboard', { href: d.mutation.reportUrl }));
    live.append(link);
  }
};

// No recorded duration means the run's start time was unknown: returning false keeps
// the block's true fallback instead of inventing a number.
export const renderDuration: Renderer = (live, d) => {
  if (d.pipelineSeconds === undefined) return false;
  const m = Math.floor(d.pipelineSeconds / 60);
  const s = d.pipelineSeconds % 60;
  live.append(el('p', `This build went through the pipeline in ${m} min ${s} s.`));
  return true;
};
