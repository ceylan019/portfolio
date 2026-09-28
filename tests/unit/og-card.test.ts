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
