// Usage: tsx scripts/check-content.ts [content dir, default src/content] [--images-only file ...]
// Blocks images that carry GPS, owner or creator data in EXIF, XMP or IPTC, a profile
// photo that is the wrong file type or too small, and an About text that repeats the
// tagline or runs long (E18, G1, D14, REQ-CONTENT-01). Exits 1 with one plain message per
// problem found.
import { existsSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import exifr from 'exifr';
import * as exifrModule from 'exifr';
import { parse as parseYaml } from 'yaml';
import { isRecord } from '../src/lib/guards';
import { identifyingExifKeys, identifyingIptcKeys, identifyingXmpKeys } from '../src/lib/exif';
import { walkFiles } from './node-fs';
import { aboutProblems } from '../src/lib/content-rules';
import { splitFrontmatter } from '../src/lib/frontmatter';
import { resolvePhotoPath } from '../src/lib/content-paths';
import { photoProblem } from '../src/content-schemas';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic']);

// sharp's metadata().exif buffer keeps the "Exif\0\0" chunk tag in front of the TIFF payload
// for JPEG and WebP source images (not for PNG), but exifr's own format sniffing only
// recognizes a bare TIFF header, so the tag has to be stripped before the buffer is handed
// to exifr. Verified with sharp 0.35.5 and exifr 7.1.3 by reading generated JPEG, WebP and
// AVIF files back (tests/unit/check-content.test.ts builds the same files).
const EXIF_CHUNK_TAG = Buffer.from('Exif\0\0', 'latin1');

function tiffPayload(exif: Buffer): Buffer {
  return exif.subarray(0, EXIF_CHUNK_TAG.length).equals(EXIF_CHUNK_TAG) ? exif.subarray(EXIF_CHUNK_TAG.length) : exif;
}

// exifr does not always reject a malformed TIFF payload by throwing. A structure that
// starts out valid but is truncated or corrupted partway through resolves with an object
// shaped like { errors: [...] } instead (verified with sharp 0.35.5 and exifr 7.1.3 on a
// JPEG whose EXIF chunk was overwritten partway through). Both outcomes must fail closed,
// or a corrupted GPS chunk would read as "no identifying tags" and pass.
function hasParseErrors(tags: unknown): boolean {
  return isRecord(tags) && Array.isArray(tags.errors) && tags.errors.length > 0;
}

const walk = (dir: string): string[] => (existsSync(dir) ? walkFiles(dir).map((f) => join(dir, f)) : []);

// sharp returns XMP as the raw packet and IPTC as the Photoshop resource block, for every
// format it reads. exifr's sidecar() parses each on its own (verified with sharp 0.35.5 and
// exifr 7.1.3: withXmp() round-trips through JPEG, PNG, WebP and AVIF, and a JPEG APP13
// IPTC block comes back through metadata().iptc). sharp cannot write IPTC, so the tests
// build that block by hand. exifr resolves a packet it cannot read as XML to undefined
// rather than throwing, so a present packet with no parsed result fails closed too.
//
// exifr 7.1.3's ESM build (what Vite and Vitest load) exports sidecar() by name only,
// while its CommonJS build (what tsx loads through package.json "main") has it only on the
// default export. Take whichever exists.
const sidecar: typeof exifr.sidecar = (exifrModule as Partial<typeof exifrModule>).sidecar ?? exifr.sidecar;
type Parsed = { ok: true; tags: Record<string, unknown> } | { ok: false };
async function parseSegment(buf: Buffer, type: 'xmp' | 'iptc'): Promise<Parsed> {
  try {
    const tags: unknown = await sidecar(buf, {}, type);
    return isRecord(tags) && !hasParseErrors(tags) ? { ok: true, tags } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** Reads a raw XMP packet and returns its identifying keys, or null when the packet
 * cannot be parsed (the caller fails closed). */
export async function xmpProblemKeys(xmp: Buffer): Promise<string[] | null> {
  const r = await parseSegment(xmp, 'xmp');
  return r.ok ? identifyingXmpKeys(r.tags) : null;
}

// The Photoshop resource that holds IPTC: "8BIM" followed by resource id 0x0404. sharp
// returns the whole resource block, which may hold other resources (a thumbnail, print
// settings) before it, and exifr's sidecar() reads datasets from the start of what it is
// given, so the block is cut at this resource first.
const IPTC_RESOURCE = Buffer.from([0x38, 0x42, 0x49, 0x4d, 0x04, 0x04]);

/** Reads a raw IPTC (Photoshop resource) block and returns its identifying keys. A block
 * with no IPTC resource has nothing to check. One whose IPTC resource yields no datasets
 * cannot be read, so it returns null and the caller fails closed (exifr resolves such a
 * block to an empty object rather than throwing). */
export async function iptcProblemKeys(iptc: Buffer): Promise<string[] | null> {
  const at = iptc.indexOf(IPTC_RESOURCE);
  if (at < 0) return [];
  const r = await parseSegment(iptc.subarray(at), 'iptc');
  return r.ok && Object.keys(r.tags).length > 0 ? identifyingIptcKeys(r.tags) : null;
}

/** Reads one image's EXIF, XMP and IPTC through sharp, which covers WebP and AVIF unlike
 * exifr's own file reader, and reports it as a problem when any of them carries GPS,
 * owner or creator metadata. Fails closed: an image sharp cannot read, or a metadata block
 * exifr cannot parse, is reported as a problem too, never passed through silently (E18). */
export async function checkImage(file: string): Promise<string | null> {
  const unreadable = `${file}: could not read metadata.`;
  let meta: { exif?: Buffer; xmp?: Buffer; iptc?: Buffer };
  try {
    meta = await sharp(file).metadata();
  } catch {
    return unreadable;
  }

  const keys: string[] = [];
  if (meta.exif) {
    let tags: Record<string, unknown> | undefined;
    try {
      tags = await exifr.parse(tiffPayload(meta.exif), { gps: true, tiff: true, exif: true });
    } catch {
      return unreadable;
    }
    if (hasParseErrors(tags)) return unreadable;
    keys.push(...identifyingExifKeys(tags));
  }
  if (meta.xmp) {
    const xmpKeys = await xmpProblemKeys(meta.xmp);
    if (!xmpKeys) return unreadable;
    keys.push(...xmpKeys.map((k) => `XMP ${k}`));
  }
  if (meta.iptc) {
    const iptcKeys = await iptcProblemKeys(meta.iptc);
    if (!iptcKeys) return unreadable;
    keys.push(...iptcKeys.map((k) => `IPTC ${k}`));
  }
  return keys.length > 0
    ? `${file} contains identifying metadata (${keys.join(', ')}). Strip it first: see docs/runbook.md.`
    : null;
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
