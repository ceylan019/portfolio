import { readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';
import { LIMITS, parseQualityReport, type QualityReport } from '../../src/lib/quality-schema';

/** Every test blocks analytics and records console errors (REQ-HEALTH-01). */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/cloudflareinsights\.com/, (route) => route.abort());
    await use(errors);
  }, { auto: true }],
});
export { expect };

/** Waits until every data block has settled (E14), whatever its final state. */
export async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLElement>('[data-block]')].every((b) => b.dataset.settled === 'true'));
}

/** Serves a quality.json variant; null means 404. */
export async function serveQuality(page: Page, body: string | null, status = 200): Promise<void> {
  await page.route('**/quality.json', (route) => body === null
    ? route.fulfill({ status: 404, body: 'Not found' })
    : route.fulfill({ status, contentType: 'application/json', body }));
}

// Ruling P20: wrangler dev serves public/_headers exactly (Task 18 evidence),
// so these are exact values, not substrings.
export const SECURITY_HEADERS = {
  'content-security-policy': "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'x-frame-options': 'DENY',
};

/** The raw text of a file in tests/fixtures/quality. */
export const qualityFixture = (name: string): string => readFileSync(`tests/fixtures/quality/${name}.json`, 'utf8');

/** A fresh, schema-valid copy of the valid fixture, safe to modify. */
export const validQuality = (): QualityReport => JSON.parse(qualityFixture('valid')) as QualityReport;

function mustParse(doc: QualityReport): string {
  const parsed = parseQualityReport(doc);
  if (!parsed.ok) throw new Error(`routed variant is not schema-valid: ${parsed.reason}`);
  return JSON.stringify(doc);
}

/** Valid, with only 2 history points: the trends block shows the sparse message (D19). */
export function sparseQuality(): string {
  const doc = validQuality();
  return mustParse({ ...doc, history: doc.history.slice(0, 2) });
}

/**
 * Valid, with the matrix at its schema limit (LIMITS.requirements rows), each
 * row text a maximum-length unbroken string, so the matrix is exercised at
 * many rows and with overflow-prone text (D19, T20-A).
 */
export function manyRowsQuality(): string {
  const doc = validQuality();
  const row = doc.matrix[0]!;
  const matrix = Array.from({ length: LIMITS.requirements }, (_, i) => ({
    ...row,
    id: `REQ-R${Math.floor(i / 100)}-${String(i % 100).padStart(2, '0')}`,
    text: `Row${i}:${'x'.repeat(LIMITS.string - 8)}`.slice(0, LIMITS.string),
  }));
  return mustParse({ ...doc, matrix, counts: { ...doc.counts, requirements: matrix.length } });
}

/** One matrix row past LIMITS.requirements: otherwise valid, rejected as oversized. */
export function oversizedQuality(): string {
  const doc = validQuality();
  const row = doc.matrix[0]!;
  const matrix = Array.from({ length: LIMITS.requirements + 1 }, (_, i) => ({ ...row, id: `REQ-X${Math.floor(i / 100)}-${String(i % 100).padStart(2, '0')}` }));
  const text = JSON.stringify({ ...doc, matrix });
  if (parseQualityReport(JSON.parse(text)).ok) throw new Error('oversized variant unexpectedly passes the schema');
  return text;
}
