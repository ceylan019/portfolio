// @ts-check
import { defineConfig } from 'astro/config';

const site = process.env.SITE_URL || 'https://ceylan-akyol.example.workers.dev';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
    // CSP forbids inline styles (style-src 'self'); always emit CSS files.
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      // CSP has no 'unsafe-inline' for scripts. Astro inlines small scripts
      // below this limit, so 0 forces every script into /_astro/*.js (E3).
      assetsInlineLimit: 0,
      rollupOptions: {
        // zod 4.6.5 has two prose comments that mention the pure annotation, so
        // Rollup reports INVALID_ANNOTATION and drops them. Dropping a comment
        // does not change the bundle. Hide only that warning from zod; every
        // other warning still prints.
        onwarn(warning, warn) {
          if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('/node_modules/') && warning.id.includes('/zod/')) return;
          warn(warning);
        },
      },
    },
  },
});
