import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { test, expect, settled, SECURITY_HEADERS } from './fixtures';
import { req } from '../tag';

test('@real hero renders from real content', req('REQ-HERO-01'), async ({ page }) => {
  await page.goto('/');
  await settled(page);
  await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
  await expect(page.locator('.hero .role')).not.toBeEmpty();
  await expect(page.locator('.hero .tag')).not.toBeEmpty();
  const img = page.locator('.photo-frame img');
  await expect(img).toHaveAttribute('alt', /\S/);
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
});

test('@real the CV is a PDF', req('REQ-CV-01'), async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('.hero a.btn')).toHaveAttribute('href', '/cv.pdf');
  const res = await request.get('/cv.pdf');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('@real every non-hidden certification file is rendered', req('REQ-CERT-02'), async ({ page }) => {
  const dir = 'src/content/certifications';
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml'));
  expect(files.length).toBeGreaterThan(0);
  const visible = files
    .map((f) => parse(readFileSync(`${dir}/${f}`, 'utf8')) as { hidden?: boolean })
    .filter((c) => c.hidden !== true).length;
  // An empty collection (for example a wrong glob base) must not pass as 0 == 0.
  expect(visible).toBeGreaterThan(0);
  await page.goto('/');
  await expect(page.locator('.list .row')).toHaveCount(visible);
});

test('@real unknown paths return 404', req('REQ-NF-01'), async ({ page }) => {
  expect((await page.goto('/definitely-missing'))!.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
});

test('@real security headers are served', req('REQ-SEC-01'), async ({ request }) => {
  for (const path of ['/', '/quality', '/cv.pdf']) {
    const h = (await request.get(path)).headers();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect({ path, name, value: h[name] }).toEqual({ path, name, value });
  }
});
