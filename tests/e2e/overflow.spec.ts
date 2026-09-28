import { test, expect, settled, serveQuality, manyRowsQuality } from './fixtures';
import { req } from '../tag';
import type { Page } from '@playwright/test';

// Plan Review Focus 3: a long unbroken string (the About URL, a long
// credential ID, the 40 character name, a maximum-length matrix row) must not
// scroll the page sideways at 375px, the narrowest supported phone width.
test.use({ viewport: { width: 375, height: 812 } });

async function sidewaysOverflow(page: Page): Promise<number> {
  await settled(page);
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

for (const path of ['/', '/quality', '/__states']) {
  test(`${path} does not scroll sideways at 375px`, req('REQ-STATE-01'), async ({ page }) => {
    await page.goto(path);
    expect(await page.evaluate(() => window.innerWidth)).toBe(375);
    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
  });
}

test('/quality with the matrix at its row limit does not scroll sideways at 375px', req('REQ-STATE-01'), async ({ page }) => {
  await serveQuality(page, manyRowsQuality());
  await page.goto('/quality');
  await settled(page);
  await expect(page.locator('[data-block="matrix"]')).toHaveAttribute('data-state', 'ready');
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
});
