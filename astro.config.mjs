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
    },
  },
});
