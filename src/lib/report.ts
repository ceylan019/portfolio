// Assembles quality.json from the report job's results (scripts/build-report.ts).
// Pure, so every field rule below is unit tested and mutation tested.
import {
  SCHEMA_VERSION, type HistoryPoint, type LiveCheck, type MatrixRow, type QualityReport,
} from './quality-schema';

export interface ReportInput {
  commit: string;
  now: Date;
  /** This run's start time from the GitHub API, or "" when it could not be read. */
  runStartedAt: string;
  repoUrl: string;
  runId: string;
  rows: MatrixRow[];
  counts: { tests: number; testRuns: number; axeViolations: number };
  lighthouse: QualityReport['lighthouse'];
  mutation: { score: number; killed: number; total: number };
  /** The Stryker Dashboard report URL, or "" when the upload was not confirmed. */
  strykerUrl: string;
  liveCheck: LiveCheck | undefined;
  history: HistoryPoint[];
}

/** Whole seconds from the run's start to now, or undefined when the start time is
 * unknown or unreadable. Never a made-up 0 (spec section 4, pipeline duration). */
export function pipelineSeconds(runStartedAt: string, now: Date): number | undefined {
  const started = Date.parse(runStartedAt);
  if (!Number.isFinite(started)) return undefined;
  return Math.max(0, Math.round((now.getTime() - started) / 1000));
}

/** The verdict counts what this build covered: post-deploy requirements are checked
 * after the deploy, never by the build, so they are left out. */
export function preDeployCount(rows: MatrixRow[]): number {
  return rows.filter((r) => r.phase === 'pre-deploy').length;
}

export function assembleReport(input: ReportInput): QualityReport {
  const seconds = pipelineSeconds(input.runStartedAt, input.now);
  return {
    schemaVersion: SCHEMA_VERSION,
    commit: input.commit,
    builtAt: input.now.toISOString(),
    repoUrl: input.repoUrl,
    ciRunUrl: `${input.repoUrl}/actions/runs/${input.runId}`,
    ...(seconds === undefined ? {} : { pipelineSeconds: seconds }),
    counts: { requirements: preDeployCount(input.rows), ...input.counts },
    lighthouse: input.lighthouse,
    mutation: { ...input.mutation, ...(input.strykerUrl ? { reportUrl: input.strykerUrl } : {}) },
    ...(input.liveCheck ? { liveCheck: input.liveCheck } : {}),
    matrix: input.rows,
    history: input.history,
  };
}
