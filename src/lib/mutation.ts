import { isRecord } from './guards';

const isObj = isRecord;

const DETECTED: ReadonlySet<unknown> = new Set(['Killed', 'Timeout']);
const UNDETECTED: ReadonlySet<unknown> = new Set(['Survived', 'NoCoverage']);

/**
 * Summarizes a mutation-testing-report-schema JSON (Stryker's json reporter).
 * Verified against mutation-testing-report-schema 3.8.4 (installed by
 * @stryker-mutator/core 10.0.0): report.files is a dictionary keyed by file
 * path, each file has a mutants array, and each mutant's status is one of
 * Killed, Survived, NoCoverage, CompileError, RuntimeError, Timeout, Ignored
 * or Pending. Killed and Timeout count as detected. Survived and NoCoverage
 * count against the score. CompileError, RuntimeError, Ignored and Pending
 * are excluded from both, matching the task brief.
 */
export function mutationSummary(report: unknown): { score: number; killed: number; total: number } {
  // Stryker disable next-line ArrayDeclaration: equivalent. An invented string entry is not an object, so it contributes no mutants.
  const files = isObj(report) && isObj(report.files) ? Object.values(report.files) : [];
  let killed = 0;
  let total = 0;
  for (const f of files) {
    // Stryker disable next-line ArrayDeclaration: equivalent. An invented string entry is not an object, so it has no status.
    const mutants = isObj(f) && Array.isArray(f.mutants) ? f.mutants : [];
    for (const m of mutants) {
      const status = isObj(m) ? m.status : undefined;
      if (DETECTED.has(status)) { killed++; total++; } else if (UNDETECTED.has(status)) total++;
    }
  }
  const score = total === 0 ? 0 : Math.round((killed / total) * 1000) / 10;
  return { score, killed, total };
}
