import { mutationSummary } from '../../src/lib/mutation';

test('@REQ-TRACE-01 killed and timeout count as detected; no coverage counts against', () => {
  const report = { files: {
    'a.ts': { mutants: [{ status: 'Killed' }, { status: 'Timeout' }, { status: 'Survived' }] },
    'b.ts': { mutants: [{ status: 'NoCoverage' }, { status: 'CompileError' }, { status: 'Ignored' }] },
  } };
  expect(mutationSummary(report)).toEqual({ killed: 2, total: 4, score: 50 });
});
test('@REQ-TRACE-01 an empty or malformed report scores 0', () => {
  expect(mutationSummary({ files: {} })).toEqual({ killed: 0, total: 0, score: 0 });
  expect(mutationSummary(null)).toEqual({ killed: 0, total: 0, score: 0 });
});
test('@REQ-TRACE-01 score is rounded to one decimal', () => {
  const report = { files: { 'a.ts': { mutants: [{ status: 'Killed' }, { status: 'Killed' }, { status: 'Survived' }] } } };
  expect(mutationSummary(report).score).toBe(66.7);
});
