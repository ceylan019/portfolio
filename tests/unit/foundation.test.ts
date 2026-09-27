import { readFileSync } from 'node:fs';

test('@REQ-PERF-02 astro config never inlines scripts or styles', () => {
  const config = readFileSync('astro.config.mjs', 'utf8');
  expect(config).toContain('assetsInlineLimit: 0');
  expect(config).toContain("inlineStylesheets: 'never'");
});
