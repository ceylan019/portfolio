import { readFile } from 'node:fs/promises';
import { getEntry } from 'astro:content';
import { renderOgCard } from '../og/card';
import { profilePhotoPng } from '../og/profile-photo';

// The 1200x630 link preview image (spec section 4 "Metadata and previews", D7). Cache-Control
// is set in public/_headers, not here: static endpoints render at build time and the header
// applies to the file Cloudflare serves, not this handler's response.
export async function GET({ site }: { site?: URL }) {
  const profile = await getEntry('profile', 'profile');
  if (!profile) throw new Error('Missing profile.');
  const png = await renderOgCard({
    name: profile.data.name, title: profile.data.title, site: site?.host ?? '',
    photoPng: await profilePhotoPng(process.env.CONTENT_DIR ?? 'src/content', 556),
    fonts: { medium: await readFile('src/og/fonts/SchibstedGrotesk-Medium.ttf'), bold: await readFile('src/og/fonts/SchibstedGrotesk-ExtraBold.ttf') },
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
