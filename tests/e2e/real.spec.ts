import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { test, expect, settled, straightQuotes, SECURITY_HEADERS } from './fixtures';
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

test('@real every certificate opens its WebP preview and its PDF is served', req('REQ-CERT-07'), async ({ page, request }) => {
  const dir = 'src/content/certifications';
  const withCertificate = readdirSync(dir).filter((f) => f.endsWith('.yaml'))
    .map((f) => ({ id: f.replace(/\.yaml$/, ''), ...(parse(readFileSync(`${dir}/${f}`, 'utf8')) as { name: string; hidden?: boolean; certificateImage?: string; certificate?: string }) }))
    .filter((c) => c.hidden !== true && c.certificateImage);
  await page.goto('/');
  await expect(page.locator('a[data-certificate]')).toHaveCount(withCertificate.length);
  for (const c of withCertificate) {
    await page.getByRole('link', { name: `View certificate: ${c.name}` }).click();
    const dialog = page.getByRole('dialog', { name: c.name });
    const img = dialog.getByRole('img');
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => (i.complete && i.naturalWidth > 0 ? i.currentSrc : ''))).toMatch(/\.webp$/);
    await page.keyboard.press('Escape');
    if (!c.certificate) continue;
    const res = await request.get(`/certificates/${c.id}.pdf`);
    expect(res.headers()['content-type']).toContain('application/pdf');
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  }
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

test('@real every page uses curly apostrophes and quotation marks', req('REQ-COPY-01'), async ({ page }) => {
  for (const path of ['/', '/quality', '/definitely-missing']) {
    await page.goto(path);
    await settled(page);
    expect(await straightQuotes(page), path).toEqual([]);
  }
});
