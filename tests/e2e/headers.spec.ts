import { test, expect, SECURITY_HEADERS } from './fixtures';
import { req } from '../tag';

test('security headers on every page', req('REQ-SEC-01'), async ({ request }) => {
  for (const path of ['/', '/quality', '/404', '/this/does/not/exist', '/cv.pdf', '/og.png', '/quality.json']) {
    const h = (await request.get(path)).headers();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect({ path, name, value: h[name] }).toEqual({ path, name, value });
  }
});

test('mutable files revalidate, fingerprinted assets are immutable', req('REQ-CACHE-01'), async ({ request, page }) => {
  for (const path of ['/cv.pdf', '/quality.json', '/og.png']) {
    expect({ path, cache: (await request.get(path)).headers()['cache-control'] }).toEqual({ path, cache: 'no-cache' });
  }
  for (const path of ['/', '/quality']) {
    expect({ path, cache: (await request.get(path)).headers()['cache-control'] }).toEqual({ path, cache: 'public, max-age=0, must-revalidate' });
  }
  await page.goto('/');
  const assets = await page.locator('script[src^="/_astro/"], link[rel="stylesheet"][href^="/_astro/"]').evaluateAll((els) => els.map((el) => el.getAttribute('src') ?? el.getAttribute('href')!));
  expect(assets.length).toBeGreaterThan(0);
  for (const asset of assets) {
    expect({ asset, cache: (await request.get(asset)).headers()['cache-control'] }).toEqual({ asset, cache: 'public, max-age=31536000, immutable' });
  }
});

test('unknown paths return the custom 404 page with status 404', req('REQ-NF-01'), async ({ page }) => {
  const res = await page.goto('/this/does/not/exist');
  expect(res!.status()).toBe(404);
  await expect(page.getByText("This page doesn't exist. It may have moved, or the link has a typo.")).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('/quality/ resolves to the canonical URL without a trailing slash', req('REQ-URL-01'), async ({ page }) => {
  await page.goto('/quality/');
  await expect(page).toHaveURL(/\/quality$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/How this site\s*is tested/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/quality$/);
});
