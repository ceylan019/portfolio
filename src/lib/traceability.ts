/*
 * Requirement -> test -> result (D6, E15).
 *
 *   vitest.json ─┐                 ┌─ rows (one per requirement, tests deduped, projects listed)
 *   playwright  ─┼─ TestResult[] ──┤
 *   evidence    ─┘                 └─ problems (uncovered, unknown tag, untagged, missing project)
 *
 * Verified against the installed tools (see task-5-report.md): Playwright
 * 1.63.0's json reporter writes spec.tags WITHOUT the leading @, so raw tags
 * are normalized to the @ form before both tagsIn and playwrightSuite read
 * them. Vitest 5.0.2's json reporter matches the assumed shape (fullName,
 * title, status, location.line with includeTaskLocation), except a skipped
 * assertion reports status "skipped", not "pending".
 */
import type { CheckName, MatrixRow, CoveringTest, Suite } from './quality-schema';
import { isRecord } from './guards';

export interface Requirement {
  id: string;
  text: string;
  source: string;
  phase?: 'pre-deploy' | 'post-deploy';
  checks?: CheckName[];
}
export type ResultSuite = Suite | 'smoke';
export interface TestResult {
  title: string;
  file: string;
  line: number;
  suite: ResultSuite;
  project: string | null;
  status: 'passed' | 'failed' | 'skipped';
  tags: string[];
  annotations: { type: string; description?: string }[];
}
export interface CheckEvidence { name: CheckName; passed: boolean; examined: number; detail: string }
export type GateProblem =
  | { kind: 'uncovered'; id: string }
  | { kind: 'unknown-tag'; tag: string; test: string }
  | { kind: 'untagged'; test: string }
  | { kind: 'missing-projects'; missing: string[] };

export const FIXTURE_PROJECTS = ['chromium', 'firefox', 'webkit', 'iphone', 'pixel'] as const;
export const REAL_PROJECT = 'real-chromium';

const TAG = /@(REQ-[A-Z0-9]+-\d{2})(?![\w-])/g;

export function tagsIn(text: string): string[] {
  return [...new Set([...text.matchAll(TAG)].map((m) => m[1]!))];
}

// Anything that looks like a requirement tag (starts with @REQ-, case
// insensitive) but does not match tagsIn's strict REQ-XXXX-99 pattern is a
// malformed or near-miss tag: for example REQ-HERO-1, REQ-hero-01 or
// REQ-HERO-012. tagsIn silently drops these, which would let a test's
// intended coverage disappear instead of failing the gate. Kept verbatim
// without the leading @, so buildMatrix reports it as unknown-tag (spec
// section 8: CI fails when a test uses a tag that is not in the registry).
const REQ_LIKE = /^@REQ-/i;
function malformedReqTags(tokens: string[]): string[] {
  return [...new Set(tokens.filter((t) => REQ_LIKE.test(t) && tagsIn(t).length === 0).map((t) => t.slice(1)))];
}

const isObj = isRecord;
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const str = (x: unknown): string => (typeof x === 'string' ? x : '');
const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const relative = (file: string, rootDir: string) =>
  file.startsWith(rootDir) ? file.slice(rootDir.length).replace(/^\/+/, '') : file;

function vitestSuite(file: string): Suite {
  if (file.startsWith('tests/components/')) return 'component';
  if (file.startsWith('tests/build/')) return 'build';
  return 'unit';
}

export function normalizeVitest(report: unknown, rootDir: string): TestResult[] {
  if (!isObj(report)) return [];
  return arr(report.testResults).flatMap((fileResult) => {
    if (!isObj(fileResult)) return [];
    const file = relative(str(fileResult.name), rootDir);
    return arr(fileResult.assertionResults).filter(isObj).map((a): TestResult => {
      const title = str(a.fullName) || str(a.title);
      const status = a.status === 'passed' ? 'passed' : a.status === 'failed' ? 'failed' : 'skipped';
      return {
        title, file, line: isObj(a.location) ? num(a.location.line) : 0,
        suite: vitestSuite(file), project: null, status,
        tags: [...tagsIn(title), ...malformedReqTags(title.split(/\s+/))],
        annotations: [],
      };
    });
  });
}

// Playwright's json reporter (verified with @playwright/test 1.63.0) writes
// spec.tags without the leading @ (e.g. "REQ-HERO-01", "axe"). Normalize
// every raw tag to the @ form so both the bare reporter shape and an
// explicitly @-prefixed tag (for example from another tool) work the same.
const withAt = (tag: string) => (tag.startsWith('@') ? tag : `@${tag}`);

function playwrightSuite(tags: string[], project: string): ResultSuite {
  if (tags.includes('@smoke') || project === 'smoke') return 'smoke';
  if (tags.includes('@visual')) return 'visual';
  if (tags.includes('@axe')) return 'axe';
  if (project === REAL_PROJECT) return 'real';
  return 'e2e';
}

export function normalizePlaywright(report: unknown, rootDir: string): TestResult[] {
  if (!isObj(report)) return [];
  const testDir = isObj(report.config) ? str(report.config.rootDir) : '';
  const out: TestResult[] = [];
  const walk = (suite: unknown) => {
    if (!isObj(suite)) return;
    for (const spec of arr(suite.specs)) {
      if (!isObj(spec)) continue;
      const rawTags = arr(spec.tags).map(str).map(withAt);
      const title = str(spec.title);
      const file = relative(testDir ? `${testDir}/${str(spec.file)}` : str(spec.file), rootDir);
      const tags = [...tagsIn(`${rawTags.join(' ')} ${title}`), ...malformedReqTags(rawTags)];
      for (const t of arr(spec.tests)) {
        if (!isObj(t)) continue;
        const project = str(t.projectName);
        const status = t.status === 'expected' ? 'passed' : t.status === 'skipped' ? 'skipped' : 'failed';
        const annotations = arr(t.annotations).filter(isObj).map((a) => ({
          type: str(a.type), ...(typeof a.description === 'string' ? { description: a.description } : {}),
        }));
        out.push({ title, file, line: num(spec.line), suite: playwrightSuite(rawTags, project), project, status, tags, annotations });
      }
    }
    for (const child of arr(suite.suites)) walk(child);
  };
  for (const s of arr(report.suites)) walk(s);
  return out;
}

const testName = (t: TestResult) => `${t.file} > ${t.title}`;

export function buildMatrix(reqs: Requirement[], results: TestResult[], evidence: CheckEvidence[]) {
  const known = new Set(reqs.map((r) => r.id));
  const gated = results.filter((t) => t.suite !== 'smoke');
  const problems: GateProblem[] = [];

  for (const t of gated) {
    if (t.tags.length === 0) problems.push({ kind: 'untagged', test: testName(t) });
    for (const tag of t.tags) if (!known.has(tag)) problems.push({ kind: 'unknown-tag', tag, test: testName(t) });
  }

  const seenProjects = new Set(gated.map((t) => t.project).filter((p): p is string => p !== null));
  const missing = FIXTURE_PROJECTS.filter((p) => !seenProjects.has(p));
  if (missing.length > 0) problems.push({ kind: 'missing-projects', missing });

  const passed = gated.filter((t) => t.status === 'passed');
  const rows: MatrixRow[] = reqs.map((req) => {
    const byTest = new Map<string, CoveringTest>();
    for (const t of passed.filter((p) => p.tags.includes(req.id))) {
      const key = testName(t);
      const existing = byTest.get(key);
      if (existing) {
        if (t.project && !existing.projects.includes(t.project)) existing.projects.push(t.project);
      } else {
        byTest.set(key, { title: t.title, file: t.file, line: t.line, suite: t.suite as Suite, projects: t.project ? [t.project] : [] });
      }
    }
    const checks = (req.checks ?? []).filter((name) =>
      evidence.some((e) => e.name === name && e.passed && e.examined > 0));
    const phase = req.phase ?? 'pre-deploy';
    if (phase === 'pre-deploy' && byTest.size === 0 && checks.length === 0) problems.push({ kind: 'uncovered', id: req.id });
    return { id: req.id, text: req.text, phase, tests: [...byTest.values()], checks };
  });

  const uniqueTests = new Set(passed.map(testName));
  const fixtureProjects: readonly string[] = FIXTURE_PROJECTS;
  const testRuns = passed.filter((t) => t.project !== null && fixtureProjects.includes(t.project)).length;
  const axeViolations = gated
    .flatMap((t) => t.annotations)
    .filter((a) => a.type === 'axe-violations')
    .reduce((sum, a) => sum + (Number.parseInt(a.description ?? '0', 10) || 0), 0);

  return { rows, problems, counts: { tests: uniqueTests.size, testRuns, axeViolations } };
}

export function describeProblem(p: GateProblem): string {
  switch (p.kind) {
    case 'uncovered': return `${p.id} has no passing test or check.`;
    case 'unknown-tag': return `${p.test} uses unknown tag ${p.tag}.`;
    case 'untagged': return `${p.test} has no requirement tag.`;
    case 'missing-projects': return `No results from project(s): ${p.missing.join(', ')}.`;
  }
}
