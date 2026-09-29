// Usage: tsx scripts/stand-in-quality.ts <srcDir> <outDir> [siteUrl]
// E12: the real build is tested with a stand-in quality.json that never enters site-real.
// Copies srcDir to outDir and adds the live quality.json when it is valid, otherwise the
// valid fixture. An empty siteUrl (an unset repository variable, ruling P5) means there
// is no live site yet, so the fixture is used.
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, isAbsolute } from 'node:path';
import { fetchLiveQuality } from '../src/lib/history';
import { parseQualityReport } from '../src/lib/quality-schema';

const FIXTURE = new URL('../tests/fixtures/quality/valid.json', import.meta.url);

const [src, out, siteUrl = ''] = process.argv.slice(2);
if (!src || !out) {
  console.error('Usage: stand-in-quality <srcDir> <outDir> [siteUrl]');
  process.exit(2);
}
// outDir is deleted and refilled, and quality.json must never land in the tested build,
// so the two directories may not overlap in either direction.
const within = (parent: string, child: string) => {
  const r = relative(resolve(parent), resolve(child));
  return r === '' || (!r.startsWith('..') && !isAbsolute(r));
};
if (within(src, out) || within(out, src)) {
  console.error(`The output directory ${out} and the build ${src} must not overlap.`);
  process.exit(2);
}

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });

let live: unknown = null;
let why = 'SITE_URL is empty';
if (siteUrl) {
  const outcome = await fetchLiveQuality(`${siteUrl.replace(/\/$/, '')}/quality.json`, {
    fetch: (url, init) => fetch(url, init),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    attempts: 1,
  });
  if (outcome.kind === 'ok' && parseQualityReport(outcome.body).ok) live = outcome.body;
  else why = outcome.kind === 'error' ? outcome.reason : outcome.kind === 'not-found' ? 'HTTP 404' : 'invalid quality.json';
}
writeFileSync(join(out, 'quality.json'), live ? JSON.stringify(live) : readFileSync(FIXTURE, 'utf8'));
console.log(live ? 'Stand-in quality.json: live.' : `Stand-in quality.json: fixture (${why}).`);
