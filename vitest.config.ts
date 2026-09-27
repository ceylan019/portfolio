/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.test.ts', 'tests/build/**/*.test.ts'],
    includeTaskLocation: true,
    globals: true,
    // Use non-UTC timezone so mutation-testing can distinguish UTC accessors (getUTCMonth) from local ones (getMonth)
    env: { TZ: 'America/New_York' },
  },
});
