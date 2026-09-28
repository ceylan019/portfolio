import { test, expect, settled, serveQuality, qualityFixture, sparseQuality, manyRowsQuality, oversizedQuality } from './fixtures';
import { req } from '../tag';

for (const path of ['/', '/quality', '/404', '/__states']) {
  test(`${path} logs no console errors, including CSP violations`, req('REQ-HEALTH-01'), async ({ page, consoleErrors }) => {
    await page.goto(path);
    await settled(page);
    expect(consoleErrors).toEqual([]);
  });
}

// Every data state served with status 200 (a 404 makes the browser itself log
// the failed request, which is not a page error). The page must stay quiet
// whether the data renders or is rejected.
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
