// Mutation testing covers business logic in src/lib only (decision 0003).
// Every key below was checked against the installed @stryker-mutator/core
// 10.0.0 option schema and @stryker-mutator/vitest-runner 10.0.0 schema.
const dashboard = process.env.STRYKER_DASHBOARD_API_KEY && process.env.GITHUB_SHA;

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // pnpm keeps each package's dependencies isolated, so Stryker's default
  // "@stryker-mutator/*" glob, which it resolves next to @stryker-mutator/core
  // inside node_modules/.pnpm, never sees the vitest runner. Name it here.
  plugins: ['@stryker-mutator/vitest-runner'],
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.unit.config.ts', related: false },
  mutate: ['src/lib/**/*.ts', '!src/lib/brush-*.ts', '!src/lib/content.ts'],
  // Per-test coverage relies on patches/@stryker-mutator__vitest-runner@10.0.0.patch:
  // Vitest 5 matches test names as "describe > test", the runner as "describe test".
  // Static mutants (module-level values such as the gate regexes) are tested too.
  ignoreStatic: false,
  reporters: ['clear-text', 'progress', 'json', 'html', ...(dashboard ? ['dashboard'] : [])],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  dashboard: {
    project: process.env.STRYKER_PROJECT,
    version: process.env.GITHUB_SHA,
    reportType: 'full',
  },
  thresholds: { high: 95, low: 90, break: 90 },
};
