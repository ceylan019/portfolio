// Usage: tsx scripts/lighthouse-summary.ts <fixture|real>
// Appends this attempt's Lighthouse scores to the job summary (spec section 6 rerun
// policy: if only performance misses 95 on a single job, that job may be rerun once,
// and the rerun and both scores are recorded in the job summary). Each attempt of a
// rerun job writes its own summary, so both attempts' scores stay on the run page.
// Reads .lighthouseci/<build>/manifest.json; a missing or unreadable file is said
// plainly. It never fails the job: the lhci step already did if the budgets missed.
import { appendFileSync, readFileSync } from 'node:fs';
import { lhrsFromManifest, medianScores } from '../src/lib/evidence';

const build = process.argv[2];
if (build !== 'fixture' && build !== 'real') {
  console.error('Usage: lighthouse-summary <fixture|real>');
  process.exit(2);
}
const attempt = process.env.GITHUB_RUN_ATTEMPT || '1';
const path = `.lighthouseci/${build}/manifest.json`;
const lines = [`### Lighthouse, ${build} build, run attempt ${attempt}`, ''];

let manifest: unknown = null;
try {
  manifest = JSON.parse(readFileSync(path, 'utf8'));
} catch (error) {
  lines.push(`No scores: ${path} is missing or unreadable (${error instanceof Error ? error.message : String(error)}).`);
}
const lhrs = lhrsFromManifest(manifest);
if (manifest !== null && lhrs.length === 0) lines.push(`No scores: ${path} lists no Lighthouse runs.`);
if (lhrs.length > 0) {
  lines.push('Median of each URL\'s runs, 0 to 100.', '', '| URL | Runs | Performance (each run) | Performance | Accessibility | Best practices | SEO |', '|---|---|---|---|---|---|---|');
  for (const url of [...new Set(lhrs.map((l) => l.requestedUrl))]) {
    const runs = lhrs.filter((l) => l.requestedUrl === url);
    const each = runs.map((r) => {
      const score = r.categories.performance?.score;
      return typeof score === 'number' ? String(Math.round(score * 100)) : 'none';
    }).join(', ');
    const m = medianScores(runs, url);
    lines.push(`| ${url} | ${runs.length} | ${each} | ${m.performance} | ${m.accessibility} | ${m.bestPractices} | ${m.seo} |`);
  }
}
lines.push('', 'Rerun policy: if only performance misses 95, this job may be rerun once; a second miss is a real failure.', '');

const text = lines.join('\n');
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
