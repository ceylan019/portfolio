import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { renderOgCard, ringSvg } from '../../src/og/card';
import { profilePhotoPng } from '../../src/og/profile-photo';

test('@REQ-PREV-01 the preview card is a 1200x630 PNG', async () => {
  const photoPng = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#F2B9C4' } }).png().toBuffer();
  const png = await renderOgCard({
    name: 'Ceylan Akyol', title: 'QA Automation Engineer', site: 'ceylan-akyol.example.workers.dev', photoPng,
    fonts: { medium: readFileSync('src/og/fonts/SchibstedGrotesk-Medium.ttf'), bold: readFileSync('src/og/fonts/SchibstedGrotesk-ExtraBold.ttf') },
  });
  const meta = await sharp(png).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(['png', 1200, 630]);
});

test('@REQ-PREV-01 the ring SVG embeds both brush strokes with literal colors', () => {
  const svg = ringSvg({ size: 400 });
  expect(svg.match(/<path /g)).toHaveLength(2);
  expect(svg).toContain('#CF3F68');
  expect(svg).not.toContain('var(');
});

// The photo column is fixed at x:[704,1104], y:[115,515] on the 1200x630 canvas (ruling
// T18-C: 96px padding, a 400px photo column pinned flush right by justify-content:
// space-between, regardless of the text column's width). This samples a rectangle well
// inside that box and looks for the ring's rose or coral ink, so a name that pushes the
// photo column off-canvas (the bug T18-C fixes) fails this check instead of just the
// dimensions check above.
function hasRoseInk(data: Buffer, info: { width: number; channels: number }): boolean {
  const [x0, x1, y0, y1] = [760, 1040, 170, 460];
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * info.width + x) * info.channels;
      const r = data[i]!;
      const g = data[i + 1]!;
      if (r > 150 && g < 140 && r - g > 40) return true;
    }
  }
  return false;
}

test('@REQ-PREV-01 the ring and photo stay on canvas for a 40-character name, same as a short name', async () => {
  const photoPng = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#F2B9C4' } }).png().toBuffer();
  const fonts = { medium: readFileSync('src/og/fonts/SchibstedGrotesk-Medium.ttf'), bold: readFileSync('src/og/fonts/SchibstedGrotesk-ExtraBold.ttf') };
  const longName = 'Persephone Vasquez-Montenegro Fitzgerald';
  expect(longName).toHaveLength(40);

  for (const name of [longName, 'Ceylan Akyol']) {
    const png = await renderOgCard({ name, title: 'QA Automation Engineer', site: 'ceylan-akyol.example.workers.dev', photoPng, fonts });
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    expect(hasRoseInk(data, info)).toBe(true);
  }
});

// Fix round 1 review: src/og/profile-photo.ts used to resolve the photo path itself,
// implementing only the relative-path half of the codebase's convention. A leading-slash
// path (what Pages CMS writes, .pages.yml's media.output is /src/assets/uploads) resolved
// to a literal filesystem-root path and threw ENOENT. profilePhotoPng now resolves through
// the shared resolvePhotoPath (src/lib/content-paths.ts), the same helper
// scripts/check-content.ts uses, so both cases work here too.
test('@REQ-PREV-01 profilePhotoPng resolves a relative photo path against profile.md\'s own directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'og-photo-relative-'));
  try {
    await mkdir(join(dir, 'profile'), { recursive: true });
    await mkdir(join(dir, 'assets'), { recursive: true });
    await sharp({ create: { width: 20, height: 20, channels: 3, background: '#CF3F68' } }).png().toFile(join(dir, 'assets/photo.png'));
    await writeFile(join(dir, 'profile/profile.md'), '---\nname: Test\nphoto: ../assets/photo.png\n---\nBody.\n');

    const png = await profilePhotoPng(dir, 64);
    const meta = await sharp(png).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['png', 64, 64]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('@REQ-PREV-01 profilePhotoPng resolves a leading-slash Pages CMS photo path against the repo root, not the filesystem root', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'og-photo-leading-slash-'));
  try {
    await mkdir(join(dir, 'profile'), { recursive: true });
    // src/assets/uploads/photo.jpg is the real placeholder photo already committed to the
    // repo, at exactly the repo-root-relative path Pages CMS writes with a leading slash.
    // Before this fix, resolving this path threw ENOENT (it tried to read
    // /src/assets/uploads/photo.jpg as a literal filesystem-root path).
    await writeFile(join(dir, 'profile/profile.md'), '---\nname: Test\nphoto: /src/assets/uploads/photo.jpg\n---\nBody.\n');

    const png = await profilePhotoPng(dir, 64);
    const meta = await sharp(png).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['png', 64, 64]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
