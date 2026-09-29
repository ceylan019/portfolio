// Shared by the CI writer (scripts/build-report.ts), the tests and the browser
// loader (E6). zod/mini's own runtime core measures about 6.6 KB brotli by
// itself for a schema this shape, so the owner raised the REQ-PERF-02 first-party
// JavaScript budget from 5 KB to 10 KB on 2026-09-28 rather than dropping the
// shared schema from the browser.
import * as z from 'zod/mini';

export const SCHEMA_VERSION = 1 as const;
export const LIMITS = { requirements: 200, history: 50, testsPerRequirement: 500, string: 200 } as const;

export const SUITES = ['unit', 'component', 'build', 'e2e', 'real', 'axe', 'visual'] as const;
export const CHECKS = ['lighthouse', 'links', 'dist-scan'] as const;
export type Suite = (typeof SUITES)[number];
export type CheckName = (typeof CHECKS)[number];

const text = z.string().check(z.maxLength(LIMITS.string));
const sha = z.string().check(z.regex(/^[0-9a-f]{7,40}$/));
const https = z.string().check(z.maxLength(LIMITS.string), z.startsWith('https://'));
const isoDate = z.string().check(z.maxLength(40), z.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/));
const count = z.int().check(z.minimum(0), z.maximum(1_000_000));
const score = z.number().check(z.minimum(0), z.maximum(100));

export const coveringTestSchema = z.object({
  title: text,
  file: text,
  line: count,
  suite: z.enum(SUITES),
  projects: z.array(text).check(z.maxLength(10)),
});

export const matrixRowSchema = z.object({
  id: z.string().check(z.regex(/^REQ-[A-Z0-9]+-\d{2}$/)),
  text,
  phase: z.enum(['pre-deploy', 'post-deploy']),
  tests: z.array(coveringTestSchema).check(z.maxLength(LIMITS.testsPerRequirement)),
  checks: z.array(z.enum(CHECKS)).check(z.maxLength(CHECKS.length)),
});

export const historyPointSchema = z.object({
  commit: sha,
  date: isoDate,
  testRuns: count,
  mutationScore: score,
  lighthousePerformance: score,
});

export const liveCheckSchema = z.object({
  commit: sha,
  checkedAt: isoDate,
  files: count,
  ok: z.boolean(),
});

export const qualityReportSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  commit: sha,
  builtAt: isoDate,
  repoUrl: https,
  ciRunUrl: https,
  pipelineSeconds: count,
  counts: z.object({ requirements: count, tests: count, testRuns: count, axeViolations: count }),
  lighthouse: z.object({ performance: score, accessibility: score, bestPractices: score, seo: score }),
  mutation: z.object({ score, killed: count, total: count, reportUrl: z.optional(https) }),
  liveCheck: z.optional(liveCheckSchema),
  matrix: z.array(matrixRowSchema).check(z.maxLength(LIMITS.requirements)),
  history: z.array(historyPointSchema).check(z.maxLength(LIMITS.history)),
});

export type QualityReport = z.infer<typeof qualityReportSchema>;
export type HistoryPoint = z.infer<typeof historyPointSchema>;
export type MatrixRow = z.infer<typeof matrixRowSchema>;
export type CoveringTest = z.infer<typeof coveringTestSchema>;
export type LiveCheck = z.infer<typeof liveCheckSchema>;

export type ParseResult = { ok: true; data: QualityReport } | { ok: false; reason: string };

export function parseQualityReport(input: unknown): ParseResult {
  const r = qualityReportSchema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  // Stryker disable next-line StringLiteral: equivalent. zod reports at least one issue whenever parsing fails, so this fallback is unreachable.
  const noIssueReason = 'invalid';
  return { ok: false, reason: first ? first.path.join('.') || 'root' : noIssueReason };
}
