import { test, expect } from './fixtures';
import { req } from '../tag';
import type { Page } from '@playwright/test';

// Plan Review Focus 2: with JavaScript disabled, / and /quality show their
// true fallback sentences, keep working CV and home links, and leave no empty
// holes where live data would have gone.
test.use({ javaScriptEnabled: false });

async function expectFallbacksOnly(page: Page): Promise<void> {
  const blocks = page.locator('[data-block]');
  expect(await blocks.count()).toBeGreaterThan(0);
  for (const block of await blocks.all()) {
    await expect(block).toHaveAttribute('data-state', 'unavailable');
    expect(await block.getAttribute('data-settled')).toBeNull();
    const fallback = block.locator('[data-slot="fallback"]');
    await expect(fallback).toBeVisible();
    expect((await fallback.innerText()).trim().length).toBeGreaterThan(20);
    await expect(block.locator('[data-slot="live"]')).toBeHidden();
  }
}

test('without JavaScript the home page shows the fallback and a working CV link', req('REQ-QUAL-01', 'REQ-CV-01'), async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByText('Every change runs through automated tests in 3 browser engines and 5 device profiles before it deploys.')).toBeVisible();
  await expectFallbacksOnly(page);
  const cv = page.locator('.hero a.btn');
  await expect(cv).toBeVisible();
  const href = await cv.getAttribute('href');
  expect(href).toBe('/cv.pdf');
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Certifications', 'How this site is tested', 'About', 'Contact']);
});

test('without JavaScript /quality shows every fallback and working home and CV links', req('REQ-QUAL-01', 'REQ-NAV-01'), async ({ page, request }) => {
  await page.goto('/quality');
  await expect(page.getByText('Live results could not be loaded; the source and CI history are linked here.')).toBeVisible();
  await expect(page.getByText('Requirement coverage is unavailable right now.')).toBeVisible();
  await expectFallbacksOnly(page);
  const nav = page.getByRole('navigation', { name: 'Site' });
  const cv = nav.getByRole('link', { name: 'Download CV (PDF)' });
  expect((await request.get((await cv.getAttribute('href'))!)).headers()['content-type']).toContain('application/pdf');
  await nav.getByRole('link').first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ceylan Akyol Testname Longerthanusual Xy');
});
