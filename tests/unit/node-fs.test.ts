import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashTree, sha256, walkFiles } from '../../scripts/node-fs';

test('@REQ-GATE-02 walks nested files with forward slashes and hashes each one', () => {
  const root = mkdtempSync(join(tmpdir(), 'tree-'));
  mkdirSync(join(root, '_astro'));
  writeFileSync(join(root, 'index.html'), 'a');
  writeFileSync(join(root, '_astro', 'x.js'), 'b');
  writeFileSync(join(root, 'quality.json'), '{}');
  expect(walkFiles(root)).toEqual(['_astro/x.js', 'index.html', 'quality.json']);
  expect(hashTree(root)).toEqual({ '_astro/x.js': sha256(Buffer.from('b')), 'index.html': sha256(Buffer.from('a')) });
});
