import { test, expect, settled, serveQuality, qualityFixture, sparseQuality, manyRowsQuality, oversizedQuality } from './fixtures';
import { req } from '../tag';
import { LIMITS } from '../../src/lib/quality-schema';

const FALLBACK = 'Every change runs through automated tests in 3 browser engines and 5 device profiles before it deploys.';
const QUALITY_BLOCKS = ['verdict', 'matrix', 'integrity', 'trends', 'mutation', 'duration'];

// Spec E14 and ruling P11: missing, malformed, future version, oversized and
// schema-invalid hostile data must all settle to the exact "unavailable" state.
for (const [label, body] of [
  ['missing', null],
  ['malformed', qualityFixture('malformed')],
  ['future version', qualityFixture('future')],
  ['oversized', oversizedQuality()],
  ['schema-invalid hostile', qualityFixture('hostile')],
] as const) {
  test(`${label} data leaves true fallback sentences in place`, req('REQ-QUAL-01'), async ({ page }) => {
    await serveQuality(page, body);
    await page.goto('/');
    await settled(page);
    const strip = page.locator('[data-block="proof-strip"]');
    await expect(strip).toHaveAttribute('data-state', 'unavailable');
    await expect(strip.getByText(FALLBACK)).toBeVisible();
    await expect(strip.locator('[data-slot="live"]')).toBeEmpty();
    await page.goto('/quality');
    await settled(page);
    for (const name of QUALITY_BLOCKS) {
      await expect(page.locator(`[data-block="${name}"]`)).toHaveAttribute('data-state', 'unavailable');
      await expect(page.locator(`[data-block="${name}"] [data-slot="live"]`)).toBeEmpty();
    }
    await expect(page.getByText('Live results could not be loaded; the source and CI history are linked here.')).toBeVisible();
    await expect(page.getByText('Requirement coverage is unavailable right now.')).toBeVisible();
    await expect(page.getByText('Trend data is unavailable right now.')).toBeVisible();
    expect(await page.evaluate(() => document.body.dataset.pwned)).toBeUndefined();
  });
}

// Ruling P11: a schema-valid document with HTML and script in its strings
// renders ready, as text, with nothing injected.
test('schema-valid HTML strings render as text and never execute', req('REQ-SEC-02'), async ({ page }) => {
  await serveQuality(page, qualityFixture('hostile-valid'));
  await page.goto('/quality');
  await settled(page);
  for (const name of QUALITY_BLOCKS) await expect(page.locator(`[data-block="${name}"]`)).toHaveAttribute('data-state', 'ready');
  const matrix = page.locator('[data-block="matrix"] [data-slot="live"]');
  await expect(matrix.getByText(`<img src=x onerror="document.body.dataset.pwned='1'">`, { exact: true })).toBeVisible();
  await expect(matrix.locator('a', { hasText: "</script><script>document.body.dataset.pwned='1'</script>" })).toHaveCount(1);
  // Only the elements the renderers build: no img, script, iframe or anything else from the data.
  const tags = await page.locator('[data-slot="live"] *').evaluateAll((els) => [...new Set(els.map((e) => e.tagName.toLowerCase()))].sort());
  expect(tags.filter((t) => !['a', 'b', 'br', 'details', 'div', 'h3', 'li', 'p', 'path', 'polyline', 'span', 'strong', 'summary', 'svg', 'ul'].includes(t))).toEqual([]);
  const hrefs = await page.locator('[data-slot="live"] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(0);
  expect(hrefs.filter((h) => !h?.startsWith('https://'))).toEqual([]);
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => document.body.dataset.pwned)).toBeUndefined();
  await expect(page.locator('[data-block="verdict"]')).toContainText('999,999 test runs');
});

// Ruling T20-A: sparse history and a matrix at many rows are client-rendered
// states (D19), so they are routed variants on /quality.
test('2 history points show the sparse message', req('REQ-STATE-01'), async ({ page }) => {
  await serveQuality(page, sparseQuality());
  await page.goto('/quality');
  await settled(page);
  const trends = page.locator('[data-block="trends"]');
  await expect(trends).toHaveAttribute('data-state', 'ready');
  await expect(trends.locator('[data-slot="live"]')).toHaveText('Trends appear after 3 deploys. This is deploy 2.');
  await expect(trends.locator('.spark-line')).toHaveCount(0);
});

test('the matrix at its row limit renders every row', req('REQ-STATE-01'), async ({ page }) => {
  await serveQuality(page, manyRowsQuality());
  await page.goto('/quality');
  await settled(page);
  await expect(page.locator('[data-block="matrix"]')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('li.req')).toHaveCount(LIMITS.requirements);
  await expect(page.locator('li.req .rq-id').last()).toHaveText('REQ-R1-99');
});
