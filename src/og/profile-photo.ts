import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { parse } from 'yaml';
import { splitFrontmatter } from '../lib/frontmatter';
import { resolvePhotoPath } from '../lib/content-paths';

/** Reads the profile photo path from frontmatter (ruling T18-B: through splitFrontmatter,
 * the one frontmatter parser in the codebase, not a new regex) and returns a square PNG.
 * Satori only reads PNG and JPEG, so the source photo (jpg, png, webp or avif) is
 * normalized here. The path itself is resolved through resolvePhotoPath (fix round 1
 * review), the same helper scripts/check-content.ts uses, so a Pages CMS upload path
 * (leading slash, repo-root-relative) resolves the same way here as it does there,
 * instead of being read as a literal filesystem-root path and throwing ENOENT. */
export async function profilePhotoPng(contentDir: string, size: number): Promise<Buffer> {
  const file = resolve(contentDir, 'profile/profile.md');
  const split = splitFrontmatter(await readFile(file, 'utf8'));
  const fm = (split ? parse(split.frontmatter) : {}) as { photo?: string };
  if (!fm.photo) throw new Error('profile.md has no photo.');
  return sharp(resolvePhotoPath(file, fm.photo)).rotate().resize(size, size, { fit: 'cover' }).png().toBuffer();
}
