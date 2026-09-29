/*
 * Report job (E4, E5, E15, E19). Usage: tsx scripts/build-report.ts
 *
 *   reports-in/ ──normalize──▶ TestResult[] ─┐
 *   lhci, links, dist scans ──evidence──────┼─▶ buildMatrix ─▶ gate (exit 1 on problems)
 *   mutation.json, live history ────────────┘                └▶ out/quality.json + job summary
 *
 * Reads REPORTS_DIR (default reports-in, the downloaded artifacts). A missing, unreadable
 * or empty report means not covered (spec section 8): required reports that are absent
 * or unreadable are named gate problems, and check evidence built from them fails.
 * Needs GITHUB_SHA, GITHUB_REPOSITORY, GITHUB_RUN_ID and SITE_URL; reads GITHUB_SERVER_URL,
 * RUN_STARTED_AT, STRYKER_URL and GITHUB_STEP_SUMMARY when set.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REQUIREMENTS } from '../tests/requirements';
import {
  buildMatrix, describeProblem, normalizePlaywright, normalizeVitest, repoPath, type CheckEvidence, type TestResult,
} from '../src/lib/traceability';
import {
  combineEvidence, distScanEvidence, lhrsFromManifest, lighthouseEvidence, linksEvidence, medianScores, type Lhr,
} from '../src/lib/evidence';
import { mutationSummary } from '../src/lib/mutation';
import { appendHistory, fetchLiveQuality, resolveHistory } from '../src/lib/history';
import { SCHEMA_VERSION, liveCheckSchema, parseQualityReport } from '../src/lib/quality-schema';
import { isRecord } from '../src/lib/guards';
import { walkFiles } from './node-fs';

const OUT = 'out/quality.json';
// A failed run must never leave an earlier quality.json behind for upload.
rmSync(OUT, { force: true });

const summary: string[] = [];
const say = (line: string) => {
  summary.push(line);
  console.log(line);
};
const flush = () => {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
};
function stop(heading: string, lines: string[]): never {
  say(`\n### ${heading}\n`);
  for (const l of lines) say(`- ${l}`);
  flush();
  process.exit(1);
}

// Ruling P5: an unset repository variable arrives as "", so every read treats "" as unset.
const envProblems: string[] = [];
const need = (k: string, why: string): string => {
  const v = process.env[k] || '';
  if (!v) envProblems.push(`${k} is empty. ${why}`);
  return v;
};
const sha = need('GITHUB_SHA', 'GitHub Actions sets it for every run.');
const repository = need('GITHUB_REPOSITORY', 'GitHub Actions sets it for every run.');
const runId = need('GITHUB_RUN_ID', 'GitHub Actions sets it for every run.');
const siteUrl = need('SITE_URL', "Set the repository variable SITE_URL to the live site's URL; history is read from its /quality.json.")
  .replace(/\/$/, '');
if (envProblems.length > 0) stop('Report not built', envProblems);

const R = process.env.REPORTS_DIR || 'reports-in';
const files = existsSync(R) ? walkFiles(R).map((f) => join(R, f)) : [];
const first = (pred: (p: string) => boolean) => files.find(pred);
const segments = (p: string) => p.split(/[\\/]/);
const reportProblems: string[] = [];

type Loaded = { ok: true; data: unknown } | { ok: false; reason: string };
function load(path: string): Loaded {
  try {
    return { ok: true, data: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
/** A required report: unreadable means a named gate problem and no data. */
function loadRequired(path: string): unknown {
  const r = load(path);
  if (r.ok) return r.data;
  reportProblems.push(`${path} is unreadable: ${r.reason}`);
  return undefined;
}

// Runner paths differ between jobs (container vs host); keep the repo-relative tail.
const fixPath = (t: TestResult): TestResult => ({ ...t, file: repoPath(t.file) });
const root = process.cwd();
function testResults(paths: string[], normalize: (report: unknown, rootDir: string) => TestResult[]): TestResult[] {
  return paths.flatMap((p) => {
    const data = loadRequired(p);
    if (data === undefined) return [];
    const results = normalize(data, root);
    if (results.length === 0) reportProblems.push(`${p} contains no test results.`);
    return results;
  });
}
const vitestPaths = files.filter((p) => p.endsWith('vitest.json'));
const playwrightPaths = files.filter((p) => /playwright-[\w-]+\.json$/.test(p));
if (vitestPaths.length === 0) reportProblems.push(`No Vitest report: ${R} has no vitest.json.`);
if (playwrightPaths.length === 0) reportProblems.push(`No Playwright report: ${R} has no playwright-*.json.`);
const results = [...testResults(vitestPaths, normalizeVitest), ...testResults(playwrightPaths, normalizePlaywright)].map(fixPath);

/** Lighthouse evidence for one build from lhci-<build>/<build>/manifest.json and
 * lhci-<build>/assertion-results.json (ruling T22-A: either file missing or unreadable
 * means not covered, never an empty passing list). */
function lhci(build: 'fixture' | 'real'): { lhrs: Lhr[]; evidence: CheckEvidence } {
  const notCovered = (why: string) => ({
    lhrs: [], evidence: { name: 'lighthouse' as const, passed: false, examined: 0, detail: `${build}: ${why}` },
  });
  const inArtifact = (p: string) => segments(p).includes(`lhci-${build}`);
  const manifestPath = first((p) => inArtifact(p) && p.endsWith(`${build}/manifest.json`));
  const assertionsPath = first((p) => inArtifact(p) && p.endsWith('assertion-results.json'));
  if (!manifestPath) return notCovered(`no lhci-${build} manifest.json`);
  if (!assertionsPath) return notCovered(`no lhci-${build} assertion-results.json`);
  const manifest = load(manifestPath);
  if (!manifest.ok || !Array.isArray(manifest.data)) return notCovered(`${manifestPath} is unreadable`);
  const assertions = load(assertionsPath);
  if (!assertions.ok || !Array.isArray(assertions.data)) return notCovered(`${assertionsPath} is unreadable`);

  const lhrs = lhrsFromManifest(manifest.data);
  // lhci saves only failed assertions by default; a malformed entry counts as a failed error.
  const asserted = assertions.data.map((a) => (isRecord(a) && typeof a.level === 'string' && typeof a.passed === 'boolean'
    ? { level: a.level, passed: a.passed } : { level: 'error', passed: false }));
  const base = build === 'fixture' ? 'http://localhost:8787' : 'http://localhost:8788';
  const evidence = lighthouseEvidence({ lhrs, assertions: asserted, expectedUrls: [`${base}/`, `${base}/quality`], runsPerUrl: 3 });
  return { lhrs, evidence: { ...evidence, detail: `${build}: ${evidence.detail}` } };
}

function links(): CheckEvidence {
  const path = first((p) => p.endsWith('links.json'));
  if (!path) return { ...linksEvidence(null), detail: 'no links.json' };
  const r = load(path);
  return r.ok ? linksEvidence(r.data) : { ...linksEvidence(null), detail: `${path} is unreadable` };
}

/** Ruling P2: exactly one fixture scan and one real scan. Ruling T22-F: the real scan
 * must have run with --forbid-states, or the states page rule of REQ-CSP-01 is unchecked. */
function distScans(): CheckEvidence {
  const notCovered = (detail: string): CheckEvidence => ({ name: 'dist-scan', passed: false, examined: 0, detail });
  const fixture = files.filter((p) => p.endsWith('dist-scan-fixture.json'));
  const real = files.filter((p) => p.endsWith('dist-scan-real.json'));
  if (fixture.length !== 1 || real.length !== 1) {
    return notCovered(`expected one dist-scan-fixture.json and one dist-scan-real.json, found ${fixture.length} and ${real.length}`);
  }
  const evidenceFor = (p: string, mustForbidStates: boolean): CheckEvidence => {
    const r = load(p);
    const scan = r.ok && isRecord(r.data) ? r.data : {};
    const { scanned, findings, forbidStates } = scan;
    const valid = Array.isArray(scanned) && scanned.every((f) => typeof f === 'string') && Array.isArray(findings);
    if (!valid) return notCovered(`${p} is unreadable`);
    if (mustForbidStates && forbidStates !== true) return notCovered(`${p} was not scanned with --forbid-states`);
    return distScanEvidence({ scanned, findings });
  };
  return combineEvidence([evidenceFor(fixture[0]!, false), evidenceFor(real[0]!, true)]);
}

const fixtureLh = lhci('fixture');
const realLh = lhci('real');
const evidence = [combineEvidence([fixtureLh.evidence, realLh.evidence]), links(), distScans()];

// Published on /quality, so a missing mutation report must not become a score of 0.
const mutationPath = first((p) => p.endsWith('mutation.json'));
const mutationData = mutationPath ? loadRequired(mutationPath) : undefined;
if (!mutationPath) reportProblems.push(`No mutation report: ${R} has no mutation.json.`);
const mutation = mutationSummary(mutationData ?? null);
if (mutationData !== undefined && mutation.total === 0) reportProblems.push(`${mutationPath} contains no mutants.`);

const { rows, problems, counts } = buildMatrix(REQUIREMENTS, results, evidence);
say(`## Traceability\n\n${rows.length} requirements, ${counts.tests} tests, ${counts.testRuns} test runs.\n`);
for (const e of evidence) say(`- ${e.name}: ${e.passed ? 'passed' : 'FAILED'} (${e.detail})`);
say(`- mutation: ${mutation.score}% (${mutation.killed} of ${mutation.total} mutants killed)`);
if (problems.length > 0 || reportProblems.length > 0) {
  stop('Gate failed', [...reportProblems, ...problems.map(describeProblem)]);
}

const repoUrl = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repository}`;
const scores = medianScores(realLh.lhrs, 'http://localhost:8788/');
const liveCheckPath = first((p) => p.endsWith('live-check.json'));
const liveCheckRaw = liveCheckPath ? load(liveCheckPath) : null;
const liveCheck = liveCheckRaw?.ok ? liveCheckSchema.safeParse(liveCheckRaw.data) : null;
const prevPath = first((p) => segments(p).includes('prev-quality') && p.endsWith('quality.json'));
const prev = prevPath ? load(prevPath) : null;
const now = new Date();
const started = Date.parse(process.env.RUN_STARTED_AT || '');

const live = await fetchLiveQuality(`${siteUrl}/quality.json`, {
  fetch: (url, init) => fetch(url, init),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
});
const source = resolveHistory(live, prev?.ok ? prev.data : undefined);
if (source.kind === 'artifact') say(`\nHistory from the last successful main run, because the live quality.json failed (${live.kind === 'error' ? live.reason : 'invalid'}).`);
if (source.kind === 'fresh' && source.warning) say(`\n> Warning: ${source.warning}`);
// Ruling T22-B: history always includes this deploy's point.
const history = appendHistory(source.kind === 'fresh' ? [] : source.history, {
  commit: sha, date: now.toISOString(), testRuns: counts.testRuns,
  mutationScore: mutation.score, lighthousePerformance: scores.performance,
});

const strykerUrl = process.env.STRYKER_URL || '';
const report = {
  schemaVersion: SCHEMA_VERSION,
  commit: sha,
  builtAt: now.toISOString(),
  repoUrl,
  ciRunUrl: `${repoUrl}/actions/runs/${runId}`,
  pipelineSeconds: Number.isFinite(started) ? Math.max(0, Math.round((now.getTime() - started) / 1000)) : 0,
  counts: { requirements: rows.length, tests: counts.tests, testRuns: counts.testRuns, axeViolations: counts.axeViolations },
  lighthouse: scores,
  mutation: { ...mutation, ...(strykerUrl ? { reportUrl: strykerUrl } : {}) },
  ...(liveCheck?.success ? { liveCheck: liveCheck.data } : {}),
  matrix: rows,
  history,
};
const parsed = parseQualityReport(report);
if (!parsed.ok) stop('Report not built', [`quality.json failed its own schema at ${parsed.reason}.`]);
mkdirSync('out', { recursive: true });
writeFileSync(OUT, JSON.stringify(parsed.data));
say(`\nquality.json written: history ${source.kind}, ${history.length} point${history.length === 1 ? '' : 's'}; mutation ${mutation.score}%; Lighthouse performance ${scores.performance}.`);
flush();
