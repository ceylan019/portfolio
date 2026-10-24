import { test, expect, settled, serveQuality, type ConsoleError, qualityFixture, sparseQuality, manyRowsQuality, oversizedQuality } from './fixtures';
import { req } from '../tag';

for (const path of ['/', '/quality', '/404', '/__states']) {
  test(`${path} logs no console errors, including CSP violations`, req('REQ-HEALTH-01'), async ({ page, consoleErrors }) => {
    await page.goto(path);
    await settled(page);
    expect(consoleErrors).toEqual([]);
  });
}

// Every data state served with status 200. The page must stay quiet whether
// the data renders or is rejected.
for (const [label, body] of [
  ['malformed', qualityFixture('malformed')],
  ['future version', qualityFixture('future')],
  ['oversized', oversizedQuality()],
  ['schema-invalid hostile', qualityFixture('hostile')],
  ['schema-valid hostile', qualityFixture('hostile-valid')],
  ['sparse history', sparseQuality()],
  ['many matrix rows', manyRowsQuality()],
] as const) {
  test(`/ and /quality log no console errors with ${label} data`, req('REQ-HEALTH-01'), async ({ page, consoleErrors }) => {
    await serveQuality(page, body);
    for (const path of ['/', '/quality']) {
      await page.goto(path);
      await settled(page);
    }
    expect(consoleErrors).toEqual([]);
  });
}

// The missing (404) data state. Some engines log the failed fetch itself as a
// console error attributed to /quality.json; that one browser message is the
// only thing ignored. Every other console error, every page error and every
// CSP report stays strict.
test('/ and /quality log no console errors with missing data', req('REQ-HEALTH-01'), async ({ page, consoleErrors }) => {
  await serveQuality(page, null);
  for (const path of ['/', '/quality']) {
    await page.goto(path);
    await settled(page);
  }
  const failedFetch = (e: ConsoleError) => /\/quality\.json$/.test(e.url) && /\b404\b/.test(e.text);
  expect(consoleErrors.filter((e) => !failedFetch(e))).toEqual([]);
});
