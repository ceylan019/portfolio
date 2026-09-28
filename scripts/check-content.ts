// Usage: tsx scripts/check-content.ts [content dir, default src/content] [--images-only file ...]
// Blocks images that carry GPS or owner EXIF data, a profile photo that is the wrong file
// type or too small, and an About text that repeats the tagline or runs long (E18, G1,
// D14, REQ-CONTENT-01). Exits 1 with one plain message per problem found.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import exifr from 'exifr';
import { parse as parseYaml } from 'yaml';
import { isRecord } from '../src/lib/guards';
import { identifyingExifKeys } from '../src/lib/exif';
import { aboutProblems } from '../src/lib/content-rules';
import { splitFrontmatter } from '../src/lib/frontmatter';
import { photoProblem } from '../src/content-schemas';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic']);

// sharp's metadata().exif buffer keeps the "Exif\0\0" chunk tag in front of the TIFF payload
// for JPEG and WebP source images (not for PNG), but exifr's own format sniffing only
// recognizes a bare TIFF header, so the tag has to be stripped before the buffer is handed
// to exifr. Verified with sharp 0.35.5 and exifr 7.1.3, see task-9-report.md.
const EXIF_CHUNK_TAG = Buffer.from('Exif\0\0', 'latin1');

function tiffPayload(exif: Buffer): Buffer {
  return exif.subarray(0, EXIF_CHUNK_TAG.length).equals(EXIF_CHUNK_TAG) ? exif.subarray(EXIF_CHUNK_TAG.length) : exif;
}

// exifr does not always reject a malformed TIFF payload by throwing. A structure that
// starts out valid but is truncated or corrupted partway through resolves with an object
// shaped like { errors: [...] } instead (verified with sharp 0.35.5 and exifr 7.1.3, see
// task-9-report.md). Both outcomes must fail closed, or a corrupted GPS chunk would read
// as "no identifying tags" and pass.
function hasParseErrors(tags: unknown): boolean {
  return isRecord(tags) && Array.isArray(tags.errors) && tags.errors.length > 0;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Reads one image's EXIF through sharp, which covers WebP and AVIF unlike exifr's own file
 * reader, and reports it as a problem when it carries GPS or owner metadata. Fails closed:
 * an image sharp cannot read, or an EXIF buffer exifr cannot parse, is reported as a
 * problem too, never passed through silently (E18). */
export async function checkImage(file: string): Promise<string | null> {
  let exif: Buffer | undefined;
  try {
    ({ exif } = await sharp(file).metadata());
  } catch {
    return `${file}: could not read metadata.`;
  }
  if (!exif) return null;

  let tags: Record<string, unknown> | undefined;
  try {
    tags = await exifr.parse(tiffPayload(exif), { gps: true, tiff: true, exif: true });
  } catch {
    return `${file}: could not read metadata.`;
  }
  if (hasParseErrors(tags)) return `${file}: could not read metadata.`;

  const keys = identifyingExifKeys(tags);
  return keys.length > 0
    ? `${file} contains identifying metadata (${keys.join(', ')}). Strip it first: see docs/runbook.md.`
    : null;
}

/** Resolves the profile's `photo` field the same way content.config.ts / Astro's image()
 * resolves it: relative to profile.md's own directory, except a leading slash, which
 * .pages.yml's media.output and src/pages/cv.pdf.ts both treat as repo-root-relative
 * (T13-C, T13-D), not a literal filesystem-root path. */
export function resolvePhotoPath(profilePath: string, photo: string): string {
  return photo.startsWith('/') ? resolve(photo.slice(1)) : resolve(dirname(profilePath), photo);
}

// sharp 0.35.5 reports every AVIF file with format "heif", not "avif" (its own type
// comment: "The encoder used to compress an HEIF file, av1 (AVIF) or hevc (HEIC)"), and
// distinguishes the two only through the separate `compression` field. Verified locally:
// sharp({...}).avif().toBuffer() then .metadata() returns { format: "heif",
// compression: "av1", ... }. photoProblem only recognizes the string "avif", so without
// this remap every valid AVIF photo was rejected. A HEIC file is also "heif", but with
// compression "hevc" (or absent), and must stay rejected; only the av1 case is remapped.
export function normalizePhotoFormat(meta: { format: string; compression?: string }): string {
  return meta.format === 'heif' && meta.compression === 'av1' ? 'avif' : meta.format;
}

/** Reads the profile photo's real dimensions and format through sharp and reports it as a
 * problem under the same rule content-schemas.ts's photoProblem enforces (D14). Fails
 * closed: a photo sharp cannot read, including one that does not exist, is a problem too
 * (T13-D), never a silent pass, since content.config.ts's schema check cannot see real
 * metadata for a loader-based collection in this Astro version (see content.config.ts). */
export async function checkProfilePhoto(photoPath: string): Promise<string | null> {
  let meta: { width?: number; height?: number; format?: string; compression?: string };
  try {
    meta = await sharp(photoPath).metadata();
  } catch {
    return `${photoPath}: could not read the profile photo.`;
  }
  if (meta.width === undefined || meta.height === undefined || !meta.format) {
    return `${photoPath}: could not read the profile photo.`;
  }
  const format = normalizePhotoFormat({ format: meta.format, compression: meta.compression });
  const problem = photoProblem({ width: meta.width, height: meta.height, format });
  return problem ? `${photoPath}: ${problem}` : null;
}

/** Runs the content checks for the given CLI arguments and returns the problems found.
 * Never throws for a content problem: those come back as strings for the caller to print
 * and exit on. */
export async function checkContent(args: string[]): Promise<string[]> {
  const imagesOnly = args[0] === '--images-only';
  const problems: string[] = [];

  const candidates = imagesOnly ? args.slice(1) : [...walk('src/assets'), ...walk(args[0] ?? 'src/content')];
  const images = candidates.filter((f) => IMAGE_EXTENSIONS.has(extname(f).toLowerCase()));
  for (const file of images) {
    const problem = await checkImage(file);
    if (problem) problems.push(problem);
  }

  if (!imagesOnly) {
    const dir = args[0] ?? 'src/content';
    const profilePath = join(dir, 'profile/profile.md');
    const raw = readFileSync(profilePath, 'utf8');
    const split = splitFrontmatter(raw);
    if (!split) {
      problems.push(`${profilePath} has no frontmatter. Cannot check the About rules.`);
    } else {
      const fm = parseYaml(split.frontmatter) as { tagline?: string; photo?: string };
      problems.push(...aboutProblems(split.body, fm.tagline ?? ''));
      if (typeof fm.photo !== 'string' || fm.photo.length === 0) {
        problems.push(`${profilePath}: missing "photo". Cannot check the photo rules.`);
      } else {
        const photoProblemMessage = await checkProfilePhoto(resolvePhotoPath(profilePath, fm.photo));
        if (photoProblemMessage) problems.push(photoProblemMessage);
      }
    }
  }

  return problems;
}

async function main(): Promise<void> {
  const problems = await checkContent(process.argv.slice(2));
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.log('Content checks passed.');
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
