// Usage: gate-cli verify-manifest <site> <manifest.json> | placeholders <contentDir> | stale <sha> <remoteUrl>
// Runs in the deploy job, which installs no project dependencies and fetches only the
// pinned wrangler, with install scripts disabled (E17). The report job bundles this file
// with esbuild into dist-gate/gate-cli.mjs; at runtime it uses Node built-ins only.
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { diffManifest, manifestMatches, parseManifest } from '../src/lib/manifest';
import { findPlaceholders } from '../src/lib/placeholders';
import { isStale, parseLsRemote } from '../src/lib/stale-sha';
import { hashTree, walkFiles } from './node-fs';

const fail = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};
const requireDir = (dir: string, what: string) => {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`${what} ${dir} is not a directory.`);
};
const readText = (file: string, what: string): string => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return fail(`${what} ${file} cannot be read.`);
  }
};

function verifyManifest(site: string | undefined, manifestFile: string | undefined) {
  if (!site || !manifestFile) return fail('Usage: gate-cli verify-manifest <site> <manifest.json>');
  requireDir(site, 'The site');
  const expected = parseManifest(readText(manifestFile, 'The manifest')) ?? fail(`The manifest ${manifestFile} is not a valid manifest.`);
  const diff = diffManifest(expected, hashTree(site));
  if (!manifestMatches(diff)) {
    const lines = [
      ...diff.changed.map((f) => `  changed: ${f}`),
      ...diff.missing.map((f) => `  missing: ${f}`),
      ...diff.extra.map((f) => `  extra: ${f}`),
    ];
    fail(`Refusing to deploy: the build differs from the tested manifest.\n${lines.join('\n')}`);
  }
  console.log(`Manifest verified: ${Object.keys(expected).length} files.`);
}

function placeholders(dir: string | undefined) {
  if (!dir) return fail('Usage: gate-cli placeholders <contentDir>');
  requireDir(dir, 'The content directory');
  const files = walkFiles(dir)
    .filter((f) => /\.(md|ya?ml)$/.test(f))
    .map((f) => ({ path: `${dir}/${f}`, text: readText(`${dir}/${f}`, 'The content file') }));
  // A wrong path must not pass the launch gate by finding nothing to check.
  if (files.length === 0) fail(`Refusing to deploy: no content files found in ${dir}.`);
  const found = findPlaceholders(files);
  if (found.length > 0) fail(`Refusing to deploy: placeholder content remains; replace it before launch:\n${found.join('\n')}`);
  console.log(`No placeholder content in ${files.length} files.`);
}

function stale(runSha: string | undefined, remote: string | undefined) {
  if (!runSha || !remote) return fail('Usage: gate-cli stale <sha> <remoteUrl>');
  let listing: string;
  try {
    listing = execFileSync('git', ['ls-remote', remote, 'refs/heads/main'], { encoding: 'utf8' });
  } catch {
    return fail(`Refusing to deploy: could not read the head of main from ${remote}, so this run may be stale.`);
  }
  // Fail closed (ruling T22-E): an unknown head could let an older run overwrite a newer deploy.
  const head = parseLsRemote(listing) ?? fail(`Refusing to deploy: ${remote} has no refs/heads/main, so this run may be stale.`);
  const skip = isStale(runSha, head);
  if (skip) {
    const note = `Skipping deploy: main has moved on to ${head}; the newer run deploys.`;
    console.log(`::notice::${note}`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${note}\n`);
  } else {
    console.log(`Not stale: ${runSha} is the head of main.`);
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `stale=${skip}\n`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'verify-manifest') verifyManifest(args[0], args[1]);
else if (cmd === 'placeholders') placeholders(args[0]);
else if (cmd === 'stale') stale(args[0], args[1]);
else fail('Usage: gate-cli verify-manifest <site> <manifest.json> | placeholders <contentDir> | stale <sha> <remoteUrl>');
