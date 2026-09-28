import { test, expect } from './fixtures';
import { req } from '../tag';

// Ruling P5: an empty SITE_URL (an unset repository variable) falls back too.
const SITE = (process.env.SITE_URL || 'https://ceylan-akyol.example.workers.dev').replace(/\/$/, '');

test('Open Graph and JSON-LD metadata, and a served preview image', req('REQ-PREV-01'), async ({ page, request }) => {
  for (const [path, canonical] of [['/', SITE], ['/quality', `${SITE}/quality`]]) {
    await page.goto(path);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /\S/);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /\S/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${SITE}/og.png`);
  }
  const res = await request.get('/og.png');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
  const png = await res.body();
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  await page.goto('/');
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld).toMatchObject({ '@context': 'https://schema.org', '@type': 'Person', name: 'Ceylan Akyol Testname Longerthanusual Xy', jobTitle: 'QA Automation Engineer' });
  await page.goto('/404');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
});
