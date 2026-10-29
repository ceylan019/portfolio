import { MONTHS } from './dates';
import { plural } from './format';
import { LIMITS } from './quality-schema';

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDeployTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export interface VerdictFigures {
  requirements: number;
  tests: number;
  testRuns: number;
  builtAt: string;
  commit: string;
}

export type LedeSegment = string | { strong: string };

export interface VerdictParts {
  lede: LedeSegment[];
  deployedPrefix: string;
  deployedAt: string;
  commitPrefix: string;
  commit: string;
  ciRunLabel: string;
  sourceLabel: string;
}

export const LARGEST_VERDICT_FIGURES: VerdictFigures = {
  requirements: LIMITS.requirements,
  tests: 9999,
  testRuns: 9999,
  builtAt: '2090-09-30T00:00:00Z',
  commit: '0000000',
};

export const verdictParts = (figures: VerdictFigures): VerdictParts => ({
  lede: [
    'Every promise this site makes is tied to the checks that prove it. This build covered ',
    { strong: `all ${plural(figures.requirements, 'pre-deploy requirement', 'pre-deploy requirements')}` },
    ' with ',
    { strong: plural(figures.tests, 'test', 'tests') },
    ' (',
    { strong: plural(figures.testRuns, 'test run', 'test runs') },
    '), and nothing ships unless every one passes.',
  ],
  deployedPrefix: 'Deployed ',
  deployedAt: formatDeployTime(figures.builtAt),
  commitPrefix: ', commit ',
  commit: figures.commit.slice(0, 7),
  ciRunLabel: 'View this CI run',
  sourceLabel: 'Browse the source',
});
