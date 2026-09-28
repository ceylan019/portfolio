import { readFile } from 'node:fs/promises';
import { getEntry } from 'astro:content';

// Stable URL /cv.pdf whatever the uploaded file is called (spec section 4). Hand
// authored content keeps a plain repo-relative path (src/assets/uploads/cv.pdf).
// Pages CMS writes the same location with a leading slash: .pages.yml's uploads
// media source has output: /src/assets/uploads, and the Pages CMS docs describe
// `output` as "the public path written into content"
// (https://pagescms.org/docs/configuration/media.md, checked in Task 13). A
// leading slash is stripped before the file is read so both forms resolve.
export async function GET() {
  const profile = await getEntry('profile', 'profile');
  if (!profile) throw new Error('Missing profile content.');
  const path = profile.data.cv.replace(/^\//, '');
  const bytes = await readFile(path);
  return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
}
