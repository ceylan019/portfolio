// The @smoke suite runs against the live site (SMOKE_URL), after each deploy and
// daily (spec section 7, D27). Header values are exact, like the E2E suite: they
// match what wrangler dev serves from public/_headers (ruling P20). Production
// Workers behaviour is first verified by the first live run of this suite (T24-B).
import { test, expect, SECURITY_HEADERS } from './fixtures';
import { parseQualityReport } from '../../src/lib/quality-schema';

test('@smoke home page loads with the photo', async ({ page }) => {
  const res = await page.goto('/');
  expect(res!.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
  const img = page.locator('.photo-frame img');
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
});

test('@smoke the CV is a PDF and revalidates', async ({ request }) => {
  const res = await request.get('/cv.pdf');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  expect(res.headers()['cache-control']).toBe('no-cache');
  expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('@smoke unknown paths return 404', async ({ page }) => {
  expect((await page.goto('/smoke-missing-page'))!.status()).toBe(404);
});

test('@smoke security and cache headers are served', async ({ request }) => {
  for (const path of ['/', '/smoke-missing-page']) {
    const h = (await request.get(path)).headers();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect({ path, name, value: h[name] }).toEqual({ path, name, value });
  }
  expect((await request.get('/')).headers()['cache-control']).toBe('public, max-age=0, must-revalidate');
});

test('@smoke quality.json parses against the schema', async ({ request }) => {
  const res = await request.get('/quality.json');
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toBe('no-cache');
  const parsed = parseQualityReport(await res.json());
  expect(parsed.ok ? 'valid' : parsed.reason).toBe('valid');
});

test('@smoke the preview image is served as PNG', async ({ request }) => {
  const res = await request.get('/og.png');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
  expect(res.headers()['cache-control']).toBe('no-cache');
});
