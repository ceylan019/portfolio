import { readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';
import { LIMITS, parseQualityReport, qualityReportSchema, type QualityReport } from '../../src/lib/quality-schema';

/** A console error or uncaught page error; url is where the console says it came from ('' for page errors). */
export interface ConsoleError { text: string; url: string }

/** Every test blocks analytics and records console errors (REQ-HEALTH-01). */
export const test = base.extend<{ consoleErrors: ConsoleError[] }>({
  consoleErrors: [async ({ page }, use) => {
    const errors: ConsoleError[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push({ text: m.text(), url: m.location().url }); });
    page.on('pageerror', (e) => errors.push({ text: e.message, url: '' }));
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

/** Valid, from a run whose start time and previous live check were both unknown:
 * no pipelineSeconds and no liveCheck. */
export function firstRunQuality(): string {
  const { pipelineSeconds: _duration, liveCheck: _live, ...doc } = validQuality();
  return mustParse(doc);
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
  // Rejected for the matrix row limit and nothing else: exactly one issue, a
  // too_big on the matrix array itself (a bad row would sit at matrix.N.field).
  const parsed = parseQualityReport(JSON.parse(text));
  const issues = qualityReportSchema.safeParse(JSON.parse(text)).error?.issues ?? [];
  const onlyTheLimit = issues.length === 1 && issues[0]!.code === 'too_big' && issues[0]!.path.join('.') === 'matrix';
  if (parsed.ok || parsed.reason !== 'matrix' || !onlyTheLimit) {
    throw new Error(`oversized variant must fail only the matrix limit: ${JSON.stringify(issues.map((i) => [i.code, i.path.join('.')]))}`);
  }
  return text;
}
