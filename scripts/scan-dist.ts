// Usage: tsx scripts/scan-dist.ts <dir> <out.json> [--forbid-states]
// Scans every built HTML file for inline styles, inline scripts other than JSON-LD and,
// with --forbid-states, the fixture-only states page (REQ-CSP-01, spec section 7). Writes
// { scanned, findings, forbidStates } for the report job and exits 1 on any finding, or
// when no files or no index.html were scanned.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { scanFiles } from '../src/lib/dist-scan';
import { distScanEvidence } from '../src/lib/evidence';
import { walkFiles } from './node-fs';

const [dir, out, flag] = process.argv.slice(2);
if (!dir || !out || (flag !== undefined && flag !== '--forbid-states')) {
  console.error('Usage: scan-dist <dir> <out.json> [--forbid-states]');
  process.exit(2);
}
if (!existsSync(dir) || !statSync(dir).isDirectory()) {
  console.error(`Built HTML scan failed: ${dir} is not a directory.`);
  process.exit(1);
}

const files = walkFiles(dir).filter((f) => f.endsWith('.html')).map((path) => ({ path, html: readFileSync(join(dir, path), 'utf8') }));
const forbidStates = flag === '--forbid-states';
const result = scanFiles(files, { forbidStatesPage: forbidStates });
mkdirSync(dirname(out), { recursive: true });
// forbidStates lets the report job confirm the real build was scanned for the states page.
writeFileSync(out, JSON.stringify({ ...result, forbidStates }, null, 2));
for (const f of result.findings) console.error(`${f.file}: ${f.rule}: ${f.excerpt}`);

const evidence = distScanEvidence(result);
if (!evidence.passed) {
  const why = result.scanned.length === 0 ? 'no HTML files were scanned'
    : result.findings.length === 0 ? 'index.html was not among the scanned files'
    : `${result.findings.length} finding(s)`;
  console.error(`Built HTML scan failed: ${why} (${evidence.detail}).`);
  process.exit(1);
}
console.log(`Built HTML scan passed: ${evidence.detail}.`);
