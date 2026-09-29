import {
  buildMatrix, describeProblem, normalizePlaywright, normalizeVitest, tagsIn,
  FIXTURE_PROJECTS, REAL_PROJECT, type Requirement, type TestResult, type CheckEvidence,
} from '../../src/lib/traceability';

const r = (over: Partial<TestResult>): TestResult => ({
  title: 't', file: 'tests/e2e/a.spec.ts', line: 1, suite: 'e2e', project: 'chromium',
  status: 'passed', tags: [], annotations: [], ...over,
});
const req = (id: string, over: Partial<Requirement> = {}): Requirement => ({ id, text: id, source: '§1', ...over });
// Every project the gate requires: the 5 fixture projects plus the real build's project.
const REQUIRED = [...FIXTURE_PROJECTS, REAL_PROJECT];
const allProjects = (over: Partial<TestResult>) => REQUIRED.map((p) => r({ ...over, project: p }));

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
  test('@REQ-TRACE-01 skips a non-object file result without throwing', () => {
    const report = { testResults: [null, {
      name: '/repo/tests/unit/x.test.ts',
      assertionResults: [{ fullName: 't', title: 't', status: 'passed' }],
    }] };
    expect(normalizeVitest(report, '/repo')).toEqual([
      { title: 't', file: 'tests/unit/x.test.ts', line: 0, suite: 'unit', project: null, status: 'passed', tags: [], annotations: [] },
    ]);
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
  test('@REQ-TRACE-01 an already @-prefixed smoke, visual or axe tag is recognized on its own, without a matching project name', () => {
    const tagged = (tags: string[]) => normalizePlaywright({ suites: [{ specs: [{ title: 'x', file: 'e2e/x.spec.ts', line: 1, tags, tests: [{ projectName: 'chromium', status: 'expected', annotations: [] }] }] }], config: { rootDir: '/repo/tests' } }, '/repo')[0]!.suite;
    expect(tagged(['@smoke'])).toBe('smoke');
    expect(tagged(['@visual'])).toBe('visual');
    expect(tagged(['@axe'])).toBe('axe');
  });
  test('@REQ-TRACE-01 a malformed report yields no results', () => {
    expect(normalizePlaywright(null, '/repo')).toEqual([]);
    expect(normalizePlaywright({}, '/repo')).toEqual([]);
  });
  test('@REQ-TRACE-01 skips non-object specs and tests, falling back to an already-relative file when config is missing', () => {
    const malformed = {
      suites: [{ specs: [
        null,
        { title: 'x', file: '/repo/tests/e2e/x.spec.ts', line: 5, tags: [], tests: [null, { projectName: 'chromium', status: 'expected', annotations: [] }] },
      ] }],
    };
    expect(normalizePlaywright(malformed, '/repo')).toEqual([
      { title: 'x', file: 'tests/e2e/x.spec.ts', line: 5, suite: 'e2e', project: 'chromium', status: 'passed', tags: [], annotations: [] },
    ]);
  });
});

describe('malformed requirement tags (E15)', () => {
  test('@REQ-TRACE-01 normalizePlaywright keeps a malformed REQ tag so the gate reports it as unknown', () => {
    const out = normalizePlaywright({
      suites: [{ specs: [{ title: 'x', file: 'e2e/x.spec.ts', line: 1, tags: ['REQ-CV-01', 'REQ-HERO-1'], tests: [
        { projectName: 'chromium', status: 'expected', annotations: [] },
      ] }] }],
      config: { rootDir: '/repo/tests' },
    }, '/repo');
    expect(out[0]!.tags).toEqual(['REQ-CV-01', 'REQ-HERO-1']);
    const { problems } = buildMatrix([req('REQ-CV-01')], out, []);
    expect(problems).toContainEqual({ kind: 'unknown-tag', tag: 'REQ-HERO-1', test: 'tests/e2e/x.spec.ts > x' });
  });

  test('@REQ-TRACE-01 normalizeVitest keeps a malformed REQ token in the title so the gate reports it as unknown', () => {
    const report = { testResults: [{
      name: '/repo/tests/unit/x.test.ts',
      assertionResults: [{ fullName: 'group @REQ-CV-01 @REQ-hero-01 works', title: 't', status: 'passed' }],
    }] };
    const out = normalizeVitest(report, '/repo');
    expect(out[0]!.tags).toEqual(['REQ-CV-01', 'REQ-hero-01']);
    const { problems } = buildMatrix([req('REQ-CV-01')], out, []);
    expect(problems).toContainEqual({
      kind: 'unknown-tag', tag: 'REQ-hero-01', test: 'tests/unit/x.test.ts > group @REQ-CV-01 @REQ-hero-01 works',
    });
  });
});

describe('buildMatrix', () => {
  const passLh: CheckEvidence = { name: 'lighthouse', passed: true, examined: 12, detail: '' };

  test('@REQ-TRACE-01 covers a requirement with a passing tagged test, counting projects once', () => {
    const { rows, problems } = buildMatrix([req('REQ-CV-01')], allProjects({ title: 'cv', tags: ['REQ-CV-01'] }), []);
    expect(problems).toEqual([]);
    expect(rows[0]!.tests).toEqual([{ title: 'cv', file: 'tests/e2e/a.spec.ts', line: 1, suite: 'e2e', projects: REQUIRED }]);
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
    const results = REQUIRED.filter((p) => p !== 'iphone').map((p) => r({ project: p, tags: ['REQ-X-01'] }));
    expect(buildMatrix([req('REQ-X-01')], results, []).problems).toContainEqual({ kind: 'missing-projects', missing: ['iphone'] });
  });

  test('@REQ-TRACE-01 a missing real build report fails the gate (T22-D)', () => {
    const results = FIXTURE_PROJECTS.map((p) => r({ project: p, tags: ['REQ-X-01'] }));
    const { problems } = buildMatrix([req('REQ-X-01')], results, []);
    expect(problems).toEqual([{ kind: 'missing-projects', missing: ['real-chromium'] }]);
    expect(describeProblem(problems[0]!)).toBe('No results from project(s): real-chromium.');
  });

  test('@REQ-TRACE-01 a real build result from a smoke test does not count as the real report', () => {
    const results = [...FIXTURE_PROJECTS.map((p) => r({ project: p, tags: ['REQ-X-01'] })), r({ suite: 'smoke', project: REAL_PROJECT, tags: [] })];
    expect(buildMatrix([req('REQ-X-01')], results, []).problems).toEqual([{ kind: 'missing-projects', missing: ['real-chromium'] }]);
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

  test('@REQ-TRACE-01 the same project reported twice for one test is not duplicated, and a null project starts empty', () => {
    const results = [
      r({ title: 'cv', project: 'chromium', tags: ['REQ-CV-01'] }),
      r({ title: 'cv', project: 'chromium', tags: ['REQ-CV-01'] }),
      r({ title: 'unit', project: null, suite: 'unit', file: 'tests/unit/u.test.ts', tags: ['REQ-U-01'] }),
    ];
    const { rows } = buildMatrix([req('REQ-CV-01'), req('REQ-U-01')], results, []);
    expect(rows.find((x) => x.id === 'REQ-CV-01')!.tests).toEqual([
      { title: 'cv', file: 'tests/e2e/a.spec.ts', line: 1, suite: 'e2e', projects: ['chromium'] },
    ]);
    expect(rows.find((x) => x.id === 'REQ-U-01')!.tests).toEqual([
      { title: 'unit', file: 'tests/unit/u.test.ts', line: 1, suite: 'unit', projects: [] },
    ]);
  });

  test('@REQ-TRACE-01 problems read as plain sentences', () => {
    expect(describeProblem({ kind: 'uncovered', id: 'REQ-CV-01' })).toBe('REQ-CV-01 has no passing test or check.');
    expect(describeProblem({ kind: 'unknown-tag', tag: 'REQ-XX-99', test: 'tests/e2e/a.spec.ts > typo' }))
      .toBe('tests/e2e/a.spec.ts > typo uses unknown tag REQ-XX-99.');
    expect(describeProblem({ kind: 'untagged', test: 'tests/e2e/a.spec.ts > bare' }))
      .toBe('tests/e2e/a.spec.ts > bare has no requirement tag.');
    expect(describeProblem({ kind: 'missing-projects', missing: ['webkit'] })).toBe('No results from project(s): webkit.');
  });
});

// Mutation testing (Task 11): edge cases that pin the normalizers and the
// matrix builder exactly.
describe('normalizer edge cases', () => {
  const vitestOne = (a: unknown, name = '/repo/tests/unit/x.test.ts', root = '/repo') =>
    normalizeVitest({ testResults: [{ name, assertionResults: [a] }] }, root);

  test('@REQ-TRACE-01 vitest drops non-object assertions and treats non-string names as empty', () => {
    const report = { testResults: [{ name: '/repo/tests/unit/x.test.ts', assertionResults: [null, 'x', { fullName: 't', status: 'passed' }] }] };
    expect(normalizeVitest(report, '/repo').map((t) => t.title)).toEqual(['t']);
    expect(vitestOne({ fullName: 42, title: 'fallback', status: 'passed' })[0]!.title).toBe('fallback');
    expect(vitestOne({ fullName: 42, status: 'passed' })[0]!.title).toBe('');
  });
  test('@REQ-TRACE-01 vitest line numbers must be finite numbers', () => {
    expect(vitestOne({ fullName: 't', status: 'passed', location: { line: '7' } })[0]!.line).toBe(0);
    expect(vitestOne({ fullName: 't', status: 'passed', location: { line: Infinity } })[0]!.line).toBe(0);
    expect(vitestOne({ fullName: 't', status: 'passed', location: { line: 9 } })[0]!.line).toBe(9);
  });
  test('@REQ-TRACE-01 vitest files resolve relative to a root with or without a trailing slash', () => {
    expect(vitestOne({ fullName: 't', status: 'passed' }, '/repo/tests/unit/x.test.ts', '/repo/')[0]!.file).toBe('tests/unit/x.test.ts');
    expect(vitestOne({ fullName: 't', status: 'passed' }, '/repo//tests/unit/x.test.ts', '/repo')[0]!.file).toBe('tests/unit/x.test.ts');
    expect(vitestOne({ fullName: 't', status: 'passed' }, 'elsewhere/x.test.ts', '/repo')[0]!.file).toBe('elsewhere/x.test.ts');
  });
  test('@REQ-TRACE-01 vitest suite comes from the folder: build, component or unit', () => {
    expect(vitestOne({ fullName: 't', status: 'passed' }, '/repo/tests/build/z.test.ts')[0]!.suite).toBe('build');
    expect(vitestOne({ fullName: 't', status: 'passed' }, '/repo/tests/components/z.test.ts')[0]!.suite).toBe('component');
    expect(vitestOne({ fullName: 't', status: 'passed' }, '/repo/other/tests/build/z.test.ts')[0]!.suite).toBe('unit');
  });

  const pwSpec = (spec: Record<string, unknown>, test: Record<string, unknown> = {}) => normalizePlaywright({
    suites: [{ specs: [{ title: 'x', file: 'e2e/x.spec.ts', line: 1, tags: [], ...spec, tests: [{ projectName: 'chromium', status: 'expected', annotations: [], ...test }] }] }],
    config: { rootDir: '/repo/tests' },
  }, '/repo');

  test('@REQ-TRACE-01 playwright project "smoke" alone marks a test as smoke', () => {
    expect(pwSpec({ tags: ['REQ-CV-01'] }, { projectName: 'smoke' })[0]!.suite).toBe('smoke');
  });
  test('@REQ-TRACE-01 playwright skips non-object suites at any depth', () => {
    const out = normalizePlaywright({
      suites: [null, { specs: [], suites: [null, { specs: [{ title: 'deep', file: 'e2e/d.spec.ts', line: 2, tags: [], tests: [{ projectName: 'chromium', status: 'expected', annotations: [] }] }] }] }],
      config: { rootDir: '/repo/tests' },
    }, '/repo');
    expect(out.map((t) => t.title)).toEqual(['deep']);
  });
  test('@REQ-TRACE-01 playwright keeps only object annotations and only string descriptions', () => {
    const [t] = pwSpec({}, { annotations: [null, 'x', { type: 'note' }, { type: 'axe-violations', description: 3 }, { type: 'issue', description: 'd' }] });
    expect(t!.annotations).toStrictEqual([{ type: 'note' }, { type: 'axe-violations' }, { type: 'issue', description: 'd' }]);
  });
  test('@REQ-TRACE-01 playwright reads tags from both the tag list and the title', () => {
    expect(pwSpec({ title: 'hero @REQ-HERO-01', tags: ['REQ-CV-01', 'REQ-CV-02'] })[0]!.tags).toEqual(['REQ-CV-01', 'REQ-CV-02', 'REQ-HERO-01']);
  });
  test('@REQ-TRACE-01 playwright spec with no title gets an empty title', () => {
    expect(pwSpec({ title: undefined })[0]!.title).toBe('');
  });
});

describe('buildMatrix edge cases', () => {
  test('@REQ-TRACE-01 only evidence for the declared check covers a requirement', () => {
    const base = allProjects({ tags: ['REQ-X-01'] });
    const reqs = [req('REQ-PERF-01', { checks: ['lighthouse'] }), req('REQ-X-01')];
    const links: CheckEvidence = { name: 'links', passed: true, examined: 5, detail: '' };
    expect(buildMatrix(reqs, base, [links]).problems).toContainEqual({ kind: 'uncovered', id: 'REQ-PERF-01' });
    expect(buildMatrix(reqs, base, [links]).rows[0]!.checks).toEqual([]);
    expect(buildMatrix([req('REQ-X-01')], base, [links]).rows[0]!.checks).toEqual([]);
  });
  test('@REQ-TRACE-01 axe violations sum only axe-violations annotations, reading bad numbers as 0', () => {
    const results = [
      ...allProjects({ tags: ['REQ-X-01'] }),
      r({ title: 'a', suite: 'axe', tags: ['REQ-X-01'], annotations: [{ type: 'axe-violations', description: '2' }, { type: 'note', description: '40' }] }),
      r({ title: 'b', suite: 'axe', tags: ['REQ-X-01'], annotations: [{ type: 'axe-violations', description: '3' }, { type: 'axe-violations', description: 'many' }, { type: 'axe-violations' }] }),
    ];
    expect(buildMatrix([req('REQ-X-01')], results, []).counts.axeViolations).toBe(5);
  });
  test('@REQ-TRACE-01 several missing projects are listed in one sentence', () => {
    const results = REQUIRED.filter((p) => p !== 'iphone' && p !== 'webkit').map((p) => r({ project: p, tags: ['REQ-X-01'] }));
    const problem = buildMatrix([req('REQ-X-01')], results, []).problems.find((p) => p.kind === 'missing-projects')!;
    expect(describeProblem(problem)).toBe('No results from project(s): webkit, iphone.');
  });
  test('@REQ-TRACE-01 results with no project do not count as fixture test runs', () => {
    const results = [...allProjects({ tags: ['REQ-X-01'] }), r({ title: 'u', project: null, suite: 'unit', tags: ['REQ-X-01'] })];
    expect(buildMatrix([req('REQ-X-01')], results, []).counts.testRuns).toBe(5);
  });
});
test('@REQ-TRACE-01 a REQ-like token counts as a malformed tag only when an @ sign starts it', () => {
  const report = { testResults: [{ name: '/repo/tests/unit/x.test.ts', assertionResults: [{ fullName: 'mail@REQ-hero-01 @REQ-CV-01', status: 'passed' }] }] };
  expect(normalizeVitest(report, '/repo')[0]!.tags).toEqual(['REQ-CV-01']);
});
