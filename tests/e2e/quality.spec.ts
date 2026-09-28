import { test, expect, settled } from './fixtures';
import { req } from '../tag';

test.beforeEach(async ({ page }) => { await page.goto('/quality'); await settled(page); });

test('top line links home and to the CV', req('REQ-NAV-01'), async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Site' });
  await expect(nav.getByRole('link', { name: 'Ceylan Akyol Testname Longerthanusual Xy' })).toHaveAttribute('href', '/');
  const cv = nav.getByRole('link', { name: 'Download CV (PDF)' });
  await expect(cv).toHaveAttribute('href', '/cv.pdf');
  await expect(cv).toHaveAttribute('download', 'Ceylan-Akyol-CV.pdf');
});

test('every block renders from the fixture data', req('REQ-QUAL-01'), async ({ page }) => {
  for (const name of ['verdict', 'integrity', 'matrix', 'trends', 'mutation', 'duration']) {
    const block = page.locator(`[data-block="${name}"]`);
    await expect(block).toHaveAttribute('data-state', 'ready');
    await expect(block.locator('[data-slot="fallback"]')).toBeHidden();
  }
  await expect(page.locator('[data-block="verdict"]')).toContainText('This build covered all 4 requirements with 148 tests (312 test runs)');
  await expect(page.locator('li.req')).toHaveCount(4);
  await expect(page.locator('.spark-line')).toHaveCount(3);
  await expect(page.locator('[data-block="duration"] [data-slot="live"]')).toHaveText('This build went through the pipeline in 8 min 32 s.');
  await expect(page.getByRole('link', { name: 'Open the full report on Stryker Dashboard' })).toBeVisible();
});

test('covering tests link to permalinks at the deployed commit', req('REQ-QUAL-01'), async ({ page }) => {
  await page.locator('li.req details summary').first().click();
  const link = page.locator('li.req details a').first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'https://github.com/example/ceylan-akyol-site/blob/e5cdb92a1b2c3d4e5f60718293a4b5c6d7e8f901/tests/e2e/home.spec.ts#L12');
});
