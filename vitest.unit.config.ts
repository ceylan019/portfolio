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
  },
});
