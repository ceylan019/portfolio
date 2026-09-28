import AxeBuilder from '@axe-core/playwright';
import { test, expect, settled } from './fixtures';
import { req } from '../tag';
import type { Locator } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const path of ['/', '/quality', '/404']) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`@axe ${path} has no automated violations in ${colorScheme} mode`, req('REQ-A11Y-01'), async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(path);
      await settled(page);
      const { violations, passes } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      testInfo.annotations.push({ type: 'axe-violations', description: String(violations.length) });
      // Evidence rule E15: the scan must have examined something.
      expect(passes.length).toBeGreaterThan(0);
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
}

test('skip link, tab order and visible focus', req('REQ-A11Y-02'), async ({ page, browserName }) => {
  // WebKit follows Safari: plain Tab skips links unless the user turns on
  // "Press Tab to highlight each item", and Option+Tab (Alt+Tab) moves through
  // links too. It is the same focus order, reached with Safari's link key.
  const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  // The site's own focus ring (base.css :focus-visible), not a browser default.
  const expectRing = async (el: Locator) => {
    await expect(el).toBeFocused();
    expect(await el.evaluate((e) => { const s = getComputedStyle(e); return [s.outlineStyle, s.outlineWidth]; })).toEqual(['solid', '2px']);
  };
  await page.goto('/');
  await page.keyboard.press(tab);
  const skip = page.locator('a.skip');
  await expectRing(skip);
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await page.goto('/');
  await page.keyboard.press(tab);
  await page.keyboard.press(tab);
  await expectRing(page.locator('.hero a.btn'));
  await page.keyboard.press(tab);
  await expectRing(page.locator('.hero .links a').first());
});

test('reduced motion shows the ring without animation', req('REQ-A11Y-03'), async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const sweep of ['.ring-sweep-main', '.ring-sweep-second']) {
    expect(await page.locator(sweep).evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  }
  await expect(page.locator('.photo-frame .ring')).toBeVisible();
});

test('landmarks and unique link names', req('REQ-A11Y-04'), async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('contentinfo')).toHaveCount(1);
  const names = await page.locator('a[aria-label^="Verify credential:"]').evaluateAll((as) => as.map((a) => a.getAttribute('aria-label')));
  expect(names.length).toBeGreaterThan(0);
  expect(new Set(names).size).toBe(names.length);
});
