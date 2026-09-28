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
}, {
  // The Astro dev toolbar defaults to enabled, and getViteConfig runs the
  // compiler in its "serve" command, so without this the compiler injects
  // data-astro-source-file and data-astro-source-loc attributes into every
  // element (Astro 6.4.8, core/compile/compile.js: annotateSourceFile).
  // Those attributes are dev-only and never appear in `astro build` output
  // (its command is "build"), but they break literal-markup assertions like
  // the Task 12 skip link test. Disabled here, for component tests only.
  devToolbar: { enabled: false },
});
