// Usage: tsx scripts/write-manifest.ts <dir> <out.json>
// Writes the SHA-256 of every file in the real build except quality.json (D22). The
// deploy job checks site-real against this before it deploys (REQ-GATE-02).
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { hashTree } from './node-fs';

const [dir, out] = process.argv.slice(2);
if (!dir || !out) {
  console.error('Usage: write-manifest <dir> <out.json>');
  process.exit(2);
}
if (!existsSync(dir) || !statSync(dir).isDirectory()) {
  console.error(`Cannot write the manifest: ${dir} is not a directory.`);
  process.exit(1);
}
const manifest = hashTree(dir);
if (Object.keys(manifest).length === 0) {
  console.error(`Cannot write the manifest: ${dir} has no files.`);
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log(`Manifest: ${Object.keys(manifest).length} files.`);
