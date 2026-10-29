import { test, expect, settled } from './fixtures';
import { req } from '../tag';
import type { Locator } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/'); await settled(page); });

test('hero shows name, title, tagline and photo', req('REQ-HERO-01'), async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ceylan Akyol Testname Longerthanusual Xy');
  await expect(page.locator('.hero .role')).toHaveText('QA Automation Engineer');
  await expect(page.locator('.hero .tag')).toContainText('I build test automation');
  const img = page.locator('.photo-frame img');
  await expect(img).toHaveAttribute('alt', 'Fixture portrait');
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
});

test('CV button returns a PDF and downloads with the owner name', req('REQ-CV-01', 'REQ-CV-02'), async ({ page, request }) => {
  const btn = page.locator('.hero a.btn');
  await expect(btn).toHaveText('Download CV (PDF)');
  await expect(btn).toHaveAttribute('href', '/cv.pdf');
  await expect(btn).toHaveAttribute('download', 'Ceylan-Akyol-CV.pdf');
  const res = await request.get('/cv.pdf');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  const contactCv = page.locator('[aria-labelledby="contact-heading"] a').first();
  await expect(contactCv).toHaveAttribute('href', '/cv.pdf');
  await expect(contactCv).toHaveAttribute('download', 'Ceylan-Akyol-CV.pdf');
});

test('email, LinkedIn and GitHub appear in that order in the hero and in Contact', req('REQ-CONTACT-01'), async ({ page }) => {
  const expected = ['mailto:fixture@example.com', 'https://www.linkedin.com/in/fixture', 'https://github.com/fixture'];
  expect(await page.locator('.hero .links a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(expected);
  expect(await page.locator('[aria-labelledby="contact-heading"] a').evaluateAll((as) => as.slice(1).map((a) => a.getAttribute('href')))).toEqual(expected);
});

// Fixture "today" is 2026-09-27 (src/lib/build-date.ts). Six of the seven
// fixture certifications are visible; the hidden one never renders.
test('certifications are ordered, filtered and labelled', req('REQ-CERT-01', 'REQ-CERT-02', 'REQ-CERT-03', 'REQ-CERT-04', 'REQ-CERT-05', 'REQ-CERT-06'), async ({ page }) => {
  const rows = page.locator('.list .row');
  await expect(rows.locator('.title')).toHaveText([
    'ISTQB Test Automation Engineering',
    'ISTQB Certified Tester, Foundation Level',
    'AWS Certified Cloud Practitioner',
    'Postman API Fundamentals Student Expert',
    'International Software Testing Qualifications Board Certified Tester Advanced Level Test Analyst',
    'Scrum Fundamentals Certified',
  ]);
  await expect(page.getByText('Hidden Certification Must Not Render')).toHaveCount(0);
  await expect(rows.nth(0).locator('.meta')).toHaveText('Issued by ISTQB, November 2024. Valid until March 2099');
  // Expiring today is still valid: expired only when expiry is strictly before today.
  await expect(rows.nth(2).locator('.meta')).toHaveText('Issued by AWS, September 2023. Valid until September 2026');
  await expect(rows.nth(2)).not.toHaveClass(/\bexpired\b/);
  const expired = page.locator('.row.expired');
  await expect(expired).toHaveCount(1);
  await expect(expired.locator('.meta')).toHaveText('Issued by SCRUMstudy, January 2021. Expired January 2024');
  await expect(expired.locator('.expired-label')).toHaveText('Expired');
  const muted = await expired.locator('.title').evaluate((el) => getComputedStyle(el).color);
  const normal = await rows.nth(0).locator('.title').evaluate((el) => getComputedStyle(el).color);
  expect(muted).not.toBe(normal);
  await expect(rows.locator('.tick')).toHaveCount(5);
  // Tick and Verify link go together: one Verify link per ticked row.
  await expect(rows.getByRole('link', { name: /^Verify credential: / })).toHaveCount(5);
  await expect(rows.filter({ has: page.locator('.tick') }).getByRole('link', { name: /^Verify credential: / })).toHaveCount(5);
  await expect(rows.nth(3).locator('.tick')).toHaveCount(0);
  await expect(rows.nth(3).locator('a')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Verify credential: ISTQB Certified Tester, Foundation Level' })).toHaveAttribute('href', 'https://verify.example/ctfl');
  await expect(page.getByText('A tick means you can verify it with the issuer or view the certificate.')).toBeVisible();
});

const loadedWebp = (img: Locator) => img.evaluate((i: HTMLImageElement) => (i.complete && i.naturalWidth > 0 ? i.currentSrc : ''));

test('a certificate thumbnail opens a WebP preview that closes with Esc, the close button or a click outside', req('REQ-CERT-07'), async ({ page }) => {
  const name = 'ISTQB Certified Tester, Foundation Level';
  const thumb = page.getByRole('link', { name: `View certificate: ${name}` });
  await thumb.scrollIntoViewIfNeeded();
  await expect.poll(() => loadedWebp(thumb.locator('img'))).toMatch(/\.webp$/);
  await expect(thumb).toHaveAttribute('aria-haspopup', 'dialog');
  const dialog = page.getByRole('dialog', { name });
  await expect(dialog).toBeHidden();

  await thumb.click();
  await expect(dialog).toBeVisible();
  await expect.poll(() => loadedWebp(dialog.getByRole('img', { name: `Certificate: ${name}, issued by ISTQB` }))).toMatch(/\.webp$/);
  await expect(dialog.getByRole('link', { name: `Open PDF: ${name}` })).toHaveAttribute('href', '/certificates/b-foundation.pdf');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(thumb).toBeFocused();

  await thumb.click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(thumb).toBeFocused();

  await thumb.click();
  await page.mouse.click(4, 4);
  await expect(dialog).toBeHidden();
  await expect(thumb).toBeFocused();
});

test('the certificate preview opens from the keyboard and holds focus until closed', req('REQ-CERT-07', 'REQ-A11Y-02'), async ({ page }) => {
  const thumb = page.getByRole('link', { name: 'View certificate: ISTQB Certified Tester, Foundation Level' });
  await thumb.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'ISTQB Certified Tester, Foundation Level' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(thumb).toBeFocused();
});

test('availability line shows when switched on', req('REQ-AVAIL-01'), async ({ page }) => {
  await expect(page.locator('.hero .avail')).toHaveText('Based in Fixture City, open to remote. Available from November.');
});

// The approved section order has no requirement of its own, so this
// test is tagged with the landmark requirement and proves every section is a
// region labelled by its own heading.
test('sections follow the approved order, each labelled by its heading', req('REQ-A11Y-04'), async ({ page }) => {
  const headings = ['Certifications', 'How this site is tested', 'About', 'Contact'];
  expect(await page.locator('main h2').allTextContents()).toEqual(headings);
  const sections = page.locator('main section');
  await expect(sections).toHaveCount(headings.length);
  const labels = await sections.evaluateAll((els) => els.map((s) => {
    const id = s.getAttribute('aria-labelledby');
    const h = id ? s.querySelector(`#${CSS.escape(id)}`) : null;
    return h && h.tagName === 'H2' ? h.textContent : null;
  }));
  expect(labels).toEqual(headings);
  for (const name of headings) await expect(page.getByRole('region', { name, exact: true })).toHaveCount(1);
  await expect(page.locator('footer.foot')).toHaveText(/^Ceylan Akyol Testname Longerthanusual Xy, \d{4}$/);
});

test('proof strip upgrades to the numbered sentence', req('REQ-QUAL-01'), async ({ page }) => {
  const strip = page.locator('[data-block="proof-strip"]');
  await expect(strip).toHaveAttribute('data-state', 'ready');
  await expect(strip.locator('[data-slot="live"]')).toHaveText("This site’s code passed 312 test runs across 3 browser engines and 5 device profiles, with 0 automated accessibility violations (axe) and a Lighthouse mobile score of 100 in CI.");
  await expect(strip.locator('[data-slot="fallback"]')).toBeHidden();
});
