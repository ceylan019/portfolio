import { assembleReport, pipelineSeconds, preDeployCount, type ReportInput } from '../../src/lib/report';
import { parseQualityReport, type MatrixRow } from '../../src/lib/quality-schema';

const row = (id: string, phase: MatrixRow['phase']): MatrixRow => ({ id, text: id, phase, tests: [], checks: ['links'] });
const rows = [row('REQ-A-01', 'pre-deploy'), row('REQ-B-01', 'pre-deploy'), row('REQ-DEPLOY-01', 'post-deploy')];
const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  commit: 'e5cdb92a1b2c3d4e5f60718293a4b5c6d7e8f901',
  now: new Date('2026-09-27T09:14:00.000Z'),
  runStartedAt: '2026-09-27T09:05:28Z',
  repoUrl: 'https://github.com/example/site',
  runId: '42',
  rows,
  counts: { tests: 10, testRuns: 50, axeViolations: 0 },
  lighthouse: { performance: 99, accessibility: 100, bestPractices: 100, seo: 100 },
  mutation: { score: 100, killed: 7, total: 7 },
  strykerUrl: '',
  liveCheck: undefined,
  history: [],
  ...over,
});

describe('pipelineSeconds', () => {
  test('@REQ-QUAL-02 whole seconds from the run start to now', () => {
    expect(pipelineSeconds('2026-09-27T09:05:28Z', new Date('2026-09-27T09:14:00.000Z'))).toBe(512);
    expect(pipelineSeconds('2026-09-27T09:13:59.600Z', new Date('2026-09-27T09:14:00.000Z'))).toBe(0);
    expect(pipelineSeconds('2026-09-27T09:13:59.400Z', new Date('2026-09-27T09:14:00.000Z'))).toBe(1);
  });
  test('@REQ-QUAL-02 a start after now (clock skew) reads as 0, never negative', () => {
    expect(pipelineSeconds('2026-09-27T09:15:00Z', new Date('2026-09-27T09:14:00.000Z'))).toBe(0);
  });
  test('@REQ-QUAL-02 an empty or unreadable start time gives no duration at all', () => {
    expect(pipelineSeconds('', new Date())).toBeUndefined();
    expect(pipelineSeconds('not a date', new Date())).toBeUndefined();
  });
});

test('@REQ-QUAL-02 the requirement count leaves post-deploy requirements out', () => {
  expect(preDeployCount(rows)).toBe(2);
  expect(preDeployCount([])).toBe(0);
});

describe('assembleReport', () => {
  test('@REQ-QUAL-02 builds a schema-valid quality.json from the run', () => {
    const report = assembleReport(input());
    expect(report).toEqual({
      schemaVersion: 1,
      commit: 'e5cdb92a1b2c3d4e5f60718293a4b5c6d7e8f901',
      builtAt: '2026-09-27T09:14:00.000Z',
      repoUrl: 'https://github.com/example/site',
      ciRunUrl: 'https://github.com/example/site/actions/runs/42',
      pipelineSeconds: 512,
      counts: { requirements: 2, tests: 10, testRuns: 50, axeViolations: 0 },
      lighthouse: { performance: 99, accessibility: 100, bestPractices: 100, seo: 100 },
      mutation: { score: 100, killed: 7, total: 7 },
      matrix: rows,
      history: [],
    });
    expect(parseQualityReport(report).ok).toBe(true);
  });
  test('@REQ-QUAL-02 without a run start time the duration is omitted, not published as 0', () => {
    const report = assembleReport(input({ runStartedAt: '' }));
    expect('pipelineSeconds' in report).toBe(false);
    expect(parseQualityReport(report).ok).toBe(true);
  });
  test('@REQ-QUAL-02 the Stryker link and the live check are included only when known', () => {
    const liveCheck = { commit: '0c1d2e3', checkedAt: '2026-09-26T09:20:00Z', files: 64, ok: false };
    const report = assembleReport(input({ strykerUrl: 'https://dashboard.stryker-mutator.io/r', liveCheck }));
    expect(report.mutation).toEqual({ score: 100, killed: 7, total: 7, reportUrl: 'https://dashboard.stryker-mutator.io/r' });
    expect(report.liveCheck).toEqual(liveCheck);
    const bare = assembleReport(input());
    expect('reportUrl' in bare.mutation).toBe(false);
    expect('liveCheck' in bare).toBe(false);
  });
});
