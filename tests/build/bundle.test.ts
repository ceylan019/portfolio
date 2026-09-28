import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { brotliCompressSync } from 'node:zlib';
import { scanFiles } from '../../src/lib/dist-scan';

const DIST = process.env.BUNDLE_DIST ?? 'dist';

test('@REQ-PERF-02 first-party JavaScript is under 5 KB brotli', () => {
  expect(existsSync(`${DIST}/_astro`), `Build first: pnpm build:real (looked in ${DIST})`).toBe(true);
  const js = readdirSync(`${DIST}/_astro`).filter((f) => f.endsWith('.js'));
  expect(js.length).toBeGreaterThan(0);
  const bytes = js.reduce((sum, f) => sum + brotliCompressSync(readFileSync(`${DIST}/_astro/${f}`)).length, 0);
  expect(bytes).toBeLessThan(5 * 1024);
});

test('@REQ-PERF-02 no script is inlined into HTML', () => {
  const pages = readdirSync(DIST).filter((f) => f.endsWith('.html')).map((f) => ({ path: f, html: readFileSync(`${DIST}/${f}`, 'utf8') }));
  expect(scanFiles(pages, { forbidStatesPage: false }).findings.filter((f) => f.rule === 'inline-script')).toEqual([]);
});
