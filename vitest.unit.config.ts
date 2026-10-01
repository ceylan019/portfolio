/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Stryker runs only the fast unit tests. Component and build tests need Astro
// rendering or a built site.
export default getViteConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/unit/og-card.test.ts'],
    globals: true,
    // Same non-UTC timezone as vitest.config.ts, so the date tests still prove
    // UTC behavior (getUTCMonth, not getMonth) while Stryker mutates them.
    env: { TZ: 'America/New_York' },
    // On GitHub Actions, Vitest adds its github-actions reporter by default,
    // and that reporter appends a test report to the job summary after every
    // run. Stryker runs Vitest once per mutant, and a killed mutant is a run
    // with failing tests, so the logic job summary filled up with "failures".
    // Stryker reads its own results, so the plain reporter is enough here.
    reporters: ['default'],
  },
});
