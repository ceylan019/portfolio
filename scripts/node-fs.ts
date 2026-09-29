// File tree helpers shared by the pipeline CLIs. Node built-ins only, because
// gate-cli.ts bundles this file into the deploy job, which installs no packages (E17).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Manifest } from '../src/lib/manifest';

/** Files Workers static assets reads as configuration and never serves. */
export const NOT_SERVED = new Set(['_headers', '_redirects', '.assetsignore']);

/** Every file under root, as sorted paths relative to root with forward slashes. */
export function walkFiles(root: string): string[] {
  const out: string[] = [];
  const go = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) go(p);
      else out.push(relative(root, p).split(sep).join('/'));
    }
  };
  go(root);
  return out.sort();
}

export function sha256(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

/** SHA-256 of every file under root except the ignored paths (D22). quality.json is
 * written after the manifest, so it is ignored by default. */
export function hashTree(root: string, ignore: ReadonlySet<string> = new Set(['quality.json'])): Manifest {
  const manifest: Manifest = {};
  for (const f of walkFiles(root)) if (!ignore.has(f)) manifest[f] = sha256(readFileSync(join(root, f)));
  return manifest;
}
