import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { parse } from 'yaml';
import { splitFrontmatter } from '../lib/frontmatter';

/** Reads the profile photo path from frontmatter (ruling T18-B: through splitFrontmatter,
 * the one frontmatter parser in the codebase, not a new regex) and returns a square PNG.
 * Satori only reads PNG and JPEG, so the source photo (jpg, png, webp or avif) is
 * normalized here. */
export async function profilePhotoPng(contentDir: string, size: number): Promise<Buffer> {
  const file = resolve(contentDir, 'profile/profile.md');
  const split = splitFrontmatter(await readFile(file, 'utf8'));
  const fm = (split ? parse(split.frontmatter) : {}) as { photo?: string };
  if (!fm.photo) throw new Error('profile.md has no photo.');
  return sharp(resolve(dirname(file), fm.photo)).rotate().resize(size, size, { fit: 'cover' }).png().toBuffer();
}
