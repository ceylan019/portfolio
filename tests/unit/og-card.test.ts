import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { renderOgCard, ringSvg } from '../../src/og/card';

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
