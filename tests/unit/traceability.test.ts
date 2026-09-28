import {
  buildMatrix, describeProblem, normalizePlaywright, normalizeVitest, tagsIn,
  FIXTURE_PROJECTS, type Requirement, type TestResult, type CheckEvidence,
} from '../../src/lib/traceability';

const r = (over: Partial<TestResult>): TestResult => ({
  title: 't', file: 'tests/e2e/a.spec.ts', line: 1, suite: 'e2e', project: 'chromium',
  status: 'passed', tags: [], annotations: [], ...over,
});
const req = (id: string, over: Partial<Requirement> = {}): Requirement => ({ id, text: id, source: '§1', ...over });
const allProjects = (over: Partial<TestResult>) => FIXTURE_PROJECTS.map((p) => r({ ...over, project: p }));

describe('tagsIn', () => {
  test('@REQ-TRACE-01 finds requirement tags and strips the @', () => {
    expect(tagsIn('@REQ-CV-01 @REQ-A11Y-02 hero works')).toEqual(['REQ-CV-01', 'REQ-A11Y-02']);
  });
  test('@REQ-TRACE-01 ignores near misses and duplicates', () => {
    expect(tagsIn('REQ-CV-01 @REQ-cv-01 @REQ-CV-1 @REQ-CV-01 @REQ-CV-01')).toEqual(['REQ-CV-01']);
  });
});

describe('normalizeVitest', () => {
  // Verified against a real `pnpm test:unit` run under Vitest 5.0.2: a
  // skipped assertion reports status "skipped", not "pending". The
  // normalizer treats any non-passed, non-failed status as skipped, so this
  // fixture uses the real value.
  test('@REQ-TRACE-01 maps assertion results with location and suite from the path', () => {
    const report = { testResults: [{
      name: '/repo/tests/unit/x.test.ts',
      assertionResults: [
        { fullName: 'group @REQ-CERT-01 sorts', title: '@REQ-CERT-01 sorts', status: 'passed', location: { line: 7, column: 3 } },
        { fullName: 'group skipped', title: 'skipped', status: 'skipped' },
      ],
    }, { name: '/repo/tests/components/y.test.ts', assertionResults: [{ fullName: '@REQ-STATE-01 empty', title: 'e', status: 'failed' }] }] };
    const out = normalizeVitest(report, '/repo');
    expect(out).toEqual([
      { title: 'group @REQ-CERT-01 sorts', file: 'tests/unit/x.test.ts', line: 7, suite: 'unit', project: null, status: 'passed', tags: ['REQ-CERT-01'], annotations: [] },
      { title: 'group skipped', file: 'tests/unit/x.test.ts', line: 0, suite: 'unit', project: null, status: 'skipped', tags: [], annotations: [] },
      { title: '@REQ-STATE-01 empty', file: 'tests/components/y.test.ts', line: 0, suite: 'component', project: null, status: 'failed', tags: ['REQ-STATE-01'], annotations: [] },
    ]);
  });
  test('@REQ-TRACE-01 a malformed report yields no results', () => {
    expect(normalizeVitest({ nope: 1 }, '/repo')).toEqual([]);
    expect(normalizeVitest(null, '/repo')).toEqual([]);
  });
});

describe('normalizePlaywright', () => {
  // Verified against a real @playwright/test 1.63.0 json reporter run
  // (throwaway spec, deleted after): spec.tags arrive WITHOUT the leading @
  // (e.g. "REQ-HERO-01", "axe"), spec.file is relative to config.rootDir,
  // spec.line is the declared test() line, and tests[].status is
  // "expected" | "skipped" | "unexpected". These fixtures use that real
  // shape; one case below keeps the @-prefixed form to prove it still works.
  const report = { suites: [{
    title: 'home.spec.ts', file: 'e2e/home.spec.ts',
    specs: [{ title: 'hero', file: 'e2e/home.spec.ts', line: 12, tags: ['REQ-HERO-01'], tests: [
      { projectName: 'chromium', status: 'expected', annotations: [] },
      { projectName: 'webkit', status: 'skipped', annotations: [] },
    ] }],
    suites: [{ title: 'nested', specs: [{ title: 'axe @axe', file: 'e2e/a11y.spec.ts', line: 3, tags: ['REQ-A11Y-01', 'axe'], tests: [
      { projectName: 'real-chromium', status: 'unexpected', annotations: [{ type: 'axe-violations', description: '2' }] },
    ] }] }],
  }], config: { rootDir: '/repo/tests' } };

  test('@REQ-TRACE-01 flattens nested suites into one result per project', () => {
    const out = normalizePlaywright(report, '/repo');
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ file: 'tests/e2e/home.spec.ts', line: 12, project: 'chromium', status: 'passed', suite: 'e2e', tags: ['REQ-HERO-01'] });
    expect(out[1]).toMatchObject({ project: 'webkit', status: 'skipped' });
    expect(out[2]).toMatchObject({ project: 'real-chromium', status: 'failed', suite: 'axe', annotations: [{ type: 'axe-violations', description: '2' }] });
  });
  test('@REQ-TRACE-01 suites come from tags and projects, with or without the leading @', () => {
    const tagged = (tags: string[], projectName: string) => normalizePlaywright({ suites: [{ specs: [{ title: 'x', file: 'e2e/x.spec.ts', line: 1, tags, tests: [{ projectName, status: 'expected', annotations: [] }] }] }], config: { rootDir: '/repo/tests' } }, '/repo')[0]!.suite;
    expect(tagged(['smoke', 'REQ-CV-01'], 'smoke')).toBe('smoke');
    expect(tagged(['visual', 'REQ-CV-01'], 'chromium')).toBe('visual');
    expect(tagged(['REQ-CV-01'], 'real-chromium')).toBe('real');
    expect(tagged(['@REQ-CV-01'], 'chromium')).toBe('e2e');
  });
});

describe('buildMatrix', () => {
  const passLh: CheckEvidence = { name: 'lighthouse', passed: true, examined: 12, detail: '' };

  test('@REQ-TRACE-01 covers a requirement with a passing tagged test, counting projects once', () => {
    const { rows, problems } = buildMatrix([req('REQ-CV-01')], allProjects({ title: 'cv', tags: ['REQ-CV-01'] }), []);
    expect(problems).toEqual([]);
    expect(rows[0]!.tests).toEqual([{ title: 'cv', file: 'tests/e2e/a.spec.ts', line: 1, suite: 'e2e', projects: [...FIXTURE_PROJECTS] }]);
  });

  test('@REQ-TRACE-01 skipped and failed tests do not cover', () => {
    const results = [...allProjects({ title: 'other', tags: ['REQ-X-01'] }), r({ tags: ['REQ-CV-01'], status: 'skipped' }), r({ title: 'f', tags: ['REQ-CV-01'], status: 'failed' })];
    const { problems } = buildMatrix([req('REQ-CV-01'), req('REQ-X-01')], results, []);
    expect(problems).toContainEqual({ kind: 'uncovered', id: 'REQ-CV-01' });
  });

  test('@REQ-TRACE-01 a declared check covers only when it passed and examined something', () => {
    const base = allProjects({ tags: ['REQ-X-01'] });
    const reqs = [req('REQ-PERF-01', { checks: ['lighthouse'] }), req('REQ-X-01')];
    expect(buildMatrix(reqs, base, [passLh]).problems).toEqual([]);
    expect(buildMatrix(reqs, base, [{ ...passLh, examined: 0 }]).problems).toContainEqual({ kind: 'uncovered', id: 'REQ-PERF-01' });
    expect(buildMatrix(reqs, base, [{ ...passLh, passed: false }]).problems).toContainEqual({ kind: 'uncovered', id: 'REQ-PERF-01' });
    expect(buildMatrix(reqs, base, []).problems).toContainEqual({ kind: 'uncovered', id: 'REQ-PERF-01' });
  });

  test('@REQ-TRACE-01 unknown and missing tags are problems', () => {
    const results = [...allProjects({ title: 'ok', tags: ['REQ-X-01'] }), r({ title: 'typo', tags: ['REQ-XX-99'] }), r({ title: 'bare', tags: [] })];
    const { problems } = buildMatrix([req('REQ-X-01')], results, []);
    expect(problems).toContainEqual({ kind: 'unknown-tag', tag: 'REQ-XX-99', test: 'tests/e2e/a.spec.ts > typo' });
    expect(problems).toContainEqual({ kind: 'untagged', test: 'tests/e2e/a.spec.ts > bare' });
  });

  test('@REQ-TRACE-01 smoke tests are ignored by the gate', () => {
    const results = [...allProjects({ tags: ['REQ-X-01'] }), r({ suite: 'smoke', project: 'smoke', tags: [] })];
    expect(buildMatrix([req('REQ-X-01')], results, []).problems).toEqual([]);
  });

  test('@REQ-TRACE-01 a missing fixture project fails the gate (E15)', () => {
    const results = FIXTURE_PROJECTS.filter((p) => p !== 'iphone').map((p) => r({ project: p, tags: ['REQ-X-01'] }));
    expect(buildMatrix([req('REQ-X-01')], results, []).problems).toContainEqual({ kind: 'missing-projects', missing: ['iphone'] });
  });

  test('@REQ-TRACE-01 post-deploy requirements are listed but never block', () => {
    const { rows, problems } = buildMatrix([req('REQ-X-01'), req('REQ-DEPLOY-01', { phase: 'post-deploy' })], allProjects({ tags: ['REQ-X-01'] }), []);
    expect(problems).toEqual([]);
    expect(rows.find((x) => x.id === 'REQ-DEPLOY-01')!.phase).toBe('post-deploy');
  });

  test('@REQ-TRACE-01 counts unique tests, fixture test runs and axe violations', () => {
    const results = [
      ...allProjects({ title: 'a', tags: ['REQ-X-01'] }),
      r({ title: 'unit', suite: 'unit', project: null, file: 'tests/unit/u.test.ts', tags: ['REQ-X-01'] }),
      r({ title: 'real', suite: 'axe', project: 'real-chromium', tags: ['REQ-X-01'], annotations: [{ type: 'axe-violations', description: '0' }] }),
      r({ title: 'skip', tags: ['REQ-X-01'], status: 'skipped' }),
    ];
    const { counts } = buildMatrix([req('REQ-X-01')], results, []);
    expect(counts).toEqual({ tests: 3, testRuns: 5, axeViolations: 0 });
  });

  test('@REQ-TRACE-01 problems read as plain sentences', () => {
    expect(describeProblem({ kind: 'uncovered', id: 'REQ-CV-01' })).toBe('REQ-CV-01 has no passing test or check.');
    expect(describeProblem({ kind: 'missing-projects', missing: ['webkit'] })).toBe('No results from project(s): webkit.');
  });
});
