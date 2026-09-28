import { readFile } from 'node:fs/promises';
import { getEntry } from 'astro:content';
import { resolveContentPath } from '../lib/content-paths';

// Stable URL /cv.pdf whatever the uploaded file is called (spec section 4). Hand
// authored content keeps a plain repo-relative path (src/assets/uploads/cv.pdf).
// Pages CMS writes the same location with a leading slash: .pages.yml's uploads
// media source has output: /src/assets/uploads, and the Pages CMS docs describe
// `output` as "the public path written into content"
// (https://pagescms.org/docs/configuration/media.md, checked in Task 13). Resolved
// through resolveContentPath (fix round 1 review), the same leading-slash handling
// src/og/profile-photo.ts and scripts/check-content.ts use, with the build's own working
// directory as the base so both a leading-slash and a plain repo-relative path resolve.
export async function GET() {
  const profile = await getEntry('profile', 'profile');
  if (!profile) throw new Error('Missing profile content.');
  const path = resolveContentPath(process.cwd(), profile.data.cv);
  const bytes = await readFile(path);
  return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
}
