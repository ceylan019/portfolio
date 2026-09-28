import { test, expect, settled, serveQuality, sparseQuality, manyRowsQuality } from './fixtures';
import { req } from '../tag';

// Runs in the chromium and pixel projects only (playwright.config.ts). Baselines
// come from the Linux Playwright container workflow, never a local machine
// (spec E23, ruling T20-B).
const PAGES = [
  { name: 'home', path: '/', data: null },
  { name: 'quality', path: '/quality', data: null },
  { name: 'states', path: '/__states', data: null },
  { name: 'notfound', path: '/404', data: null },
  // Ruling T20-A: client-rendered states (D19) are routed quality.json variants.
  { name: 'quality-sparse', path: '/quality', data: sparseQuality() },
  { name: 'quality-many-rows', path: '/quality', data: manyRowsQuality() },
] as const;

for (const { name, path, data } of PAGES) {
  for (const colorScheme of ['light', 'dark'] as const) {
    const tags = name.startsWith('quality-') ? req('REQ-VIS-01', 'REQ-STATE-01') : req('REQ-VIS-01');
    test(`@visual ${name} ${colorScheme}`, tags, async ({ page }) => {
      if (data) await serveQuality(page, data);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(path);
      await settled(page);
      await expect(page).toHaveScreenshot(`${name}-${colorScheme}.png`, { fullPage: true, mask: [page.locator('footer.foot')] });
    });
  }
}
