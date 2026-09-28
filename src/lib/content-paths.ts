import { dirname, resolve } from 'node:path';

/** Resolves a content-referenced path to a filesystem path, the one such resolver in the
 * codebase (ruling P27, fix round 1 review): relative to `baseDir` normally, or
 * repo-root-relative when the path starts with a leading slash. Pages CMS writes uploads
 * with a leading slash (.pages.yml's media.output is `/src/assets/uploads`, the Pages CMS
 * docs describe `output` as "the public path written into content",
 * https://pagescms.org/docs/configuration/media.md, checked in Task 13), so a leading
 * slash has to be treated as repo-root-relative rather than passed straight to
 * `path.resolve`, which would otherwise read it as a literal filesystem-root path and
 * throw ENOENT. */
export function resolveContentPath(baseDir: string, path: string): string {
  return path.startsWith('/') ? resolve(path.slice(1)) : resolve(baseDir, path);
}

/** Resolves the profile's `photo` field the same way content.config.ts / Astro's image()
 * resolves it: relative to profile.md's own directory, except a leading slash, which is
 * repo-root-relative (see resolveContentPath). Shared by scripts/check-content.ts and
 * src/og/profile-photo.ts so both read a Pages CMS upload path the same way (T13-C, T13-D,
 * fix round 1 review). */
export function resolvePhotoPath(profilePath: string, photo: string): string {
  return resolveContentPath(dirname(profilePath), photo);
}
