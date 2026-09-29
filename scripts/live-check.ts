// Fetches every deployed file listed in the manifest and compares SHA-256 hashes
// (REQ-DEPLOY-01, E15). It always writes its result file, so a failed check is
// recorded as failed in the next quality.json rather than left out (ruling P6).
//
//   live-check <manifest.json> <siteUrl> <out.json> <sha>
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseManifest, type Manifest } from '../src/lib/manifest';
import { NOT_SERVED, sha256 } from './node-fs';

// A hung request would otherwise run into the job's timeout, which records nothing.
// With a per-request limit it becomes one more mismatch and the result is still written.
export const REQUEST_TIMEOUT_MS = 20_000;

/** Fetches each served manifest path from the live site and returns the paths that
 * failed, differed or did not answer within timeoutMs, each with the reason. */
export async function liveMismatches(manifest: Manifest, siteUrl: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<{ paths: string[]; mismatches: string[] }> {
  const base = siteUrl.replace(/\/$/, '');
  const paths = Object.keys(manifest).filter((p) => !NOT_SERVED.has(p));
  const mismatches: string[] = [];
  for (const path of paths) {
    try {
      const res = await fetch(`${base}/${path}`, { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
      const hash = sha256(new Uint8Array(await res.arrayBuffer()));
      if (!res.ok) mismatches.push(`${path} (HTTP ${res.status})`);
      else if (hash !== manifest[path]) mismatches.push(`${path} (content differs)`);
    } catch (err) {
      mismatches.push(`${path} (request failed: ${err instanceof Error ? err.message : String(err)})`);
    }
  }
  return { paths, mismatches };
}

async function main(): Promise<void> {
  const [manifestFile, siteUrl, out, commit] = process.argv.slice(2);
  if (!manifestFile || !siteUrl || !out || !commit) {
    console.error('Usage: live-check <manifest.json> <siteUrl> <out.json> <sha>');
    process.exit(2);
  }
  const record = (files: number, ok: boolean) => writeFileSync(out, JSON.stringify({ commit, checkedAt: new Date().toISOString(), files, ok }));
  const manifest = existsSync(manifestFile) ? parseManifest(readFileSync(manifestFile, 'utf8')) : null;
  if (!manifest) {
    record(0, false);
    console.error(`Missing or invalid manifest: ${manifestFile}`);
    process.exit(1);
  }
  const { paths, mismatches } = await liveMismatches(manifest, siteUrl);
  // E15: a check that examined no files proves nothing, so it cannot pass.
  const ok = paths.length > 0 && mismatches.length === 0;
  record(paths.length, ok);
  if (paths.length === 0) {
    console.error('The manifest lists no served files, so nothing was checked.');
    process.exit(1);
  }
  if (!ok) {
    console.error(`${mismatches.length} of ${paths.length} live files differ from the tested build:\n${mismatches.join('\n')}`);
    process.exit(1);
  }
  console.log(`All ${paths.length} live files match the tested build.`);
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
