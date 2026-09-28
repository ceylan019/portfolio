import type { Renderer } from './quality-client';
import type { MatrixRow, QualityReport } from './quality-schema';
import { el, svgEl, tick } from './dom';
import { MONTHS } from './dates';

const nf = new Intl.NumberFormat('en-US');
const pad = (n: number) => String(n).padStart(2, '0');

export function plural(n: number, one: string, many: string): string {
  return `${nf.format(n)} ${n === 1 ? one : many}`;
}

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
    el('b', `all ${plural(d.counts.requirements, 'requirement', 'requirements')}`),
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

function coverage(row: MatrixRow, d: QualityReport): HTMLElement {
  const box = el('div', undefined, { class: 'rq-cov' });
  if (row.phase === 'post-deploy') {
    box.append(el('strong', 'Checked after each deploy'), el('span', 'live smoke test'));
    return box;
  }
  const suites = [...new Set(row.tests.map((t) => t.suite))];
  const projects = [...new Set(row.tests.flatMap((t) => t.projects))];
  const parts = [...(row.tests.length > 0 ? [plural(row.tests.length, 'test', 'tests')] : []), ...row.checks.map((c) => CHECK_LABELS[c])];
  box.append(el('strong', parts.join(', ')));
  if (suites.length > 0) box.append(el('span', suites.join(', ')));
  if (projects.length > 0) box.append(el('span', `${projects.length} device ${projects.length === 1 ? 'profile' : 'profiles'}`, { class: 'dim' }));
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
    li.append(tick(30), main, coverage(row, d));
    list.append(li);
  }
  live.append(list);
};

const SERIES = [
  { key: 'testRuns', label: 'Test runs passed', caption: 'Across 5 device profiles', max: null },
  { key: 'mutationScore', label: 'Mutation score', caption: 'Share of planted bugs the tests caught', max: 100 },
  { key: 'lighthousePerformance', label: 'Lighthouse mobile', caption: 'Median of 3 runs in CI', max: 100 },
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
    item.append(el('h3', s.label), el('p', s.max === 100 ? `${current}${s.key === 'mutationScore' ? '%' : ''}` : new Intl.NumberFormat('en-US').format(current), { class: 'now' }), svg, el('p', s.caption, { class: 'cap' }));
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

export const renderDuration: Renderer = (live, d) => {
  const m = Math.floor(d.pipelineSeconds / 60);
  const s = d.pipelineSeconds % 60;
  live.append(el('p', `This build went through the pipeline in ${m} min ${s} s.`));
};
