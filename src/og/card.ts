import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { RING_MAIN, RING_SECOND } from '../lib/brush-ring';

/** Light-theme ring with literal colors (satori and resvg do not resolve CSS variables). */
export function ringSvg({ size }: { size: number }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="${size}" height="${size}"><defs>`
    + '<linearGradient id="m" gradientUnits="userSpaceOnUse" x1="30" y1="30" x2="270" y2="270"><stop offset="0" stop-color="#E2557A"/><stop offset=".55" stop-color="#CF3F68"/><stop offset="1" stop-color="#F08A5D"/></linearGradient>'
    + '<linearGradient id="s" gradientUnits="userSpaceOnUse" x1="270" y1="30" x2="30" y2="270"><stop offset="0" stop-color="#F7B596"/><stop offset="1" stop-color="#F3A07E"/></linearGradient>'
    + `</defs><path d="${RING_SECOND}" fill="url(#s)"/><path d="${RING_MAIN}" fill="url(#m)"/></svg>`;
}

const dataUri = (mime: string, buf: Buffer | string) => `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node =>
  ({ type, props: { style, children, ...extra } });

/** Renders the 1200x630 link preview card (spec section 4 "Metadata and previews"): the
 * name as the loudest element on the left with the title and site address below, the
 * photo in the brush ring on the right. Satori lays the tree out as SVG, then resvg
 * rasterizes it to PNG, because satori itself only emits SVG. */
export async function renderOgCard(input: { name: string; title: string; site: string; photoPng: Buffer; fonts: { medium: Buffer; bold: Buffer } }): Promise<Buffer> {
  const [first, ...rest] = input.name.split(' ');
  const tree = h('div', { width: 1200, height: 630, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 96px', background: '#FFF6F5', color: '#2C1822', fontFamily: 'Schibsted Grotesk' }, [
    h('div', { display: 'flex', flexDirection: 'column' }, [
      h('div', { fontSize: 112, fontWeight: 800, lineHeight: 0.92, letterSpacing: -4 }, first),
      h('div', { fontSize: 112, fontWeight: 800, lineHeight: 0.92, letterSpacing: -4 }, rest.join(' ')),
      h('div', { fontSize: 36, fontWeight: 500, marginTop: 32 }, input.title),
      h('div', { fontSize: 24, fontWeight: 500, marginTop: 28, color: '#7D5F69' }, input.site),
    ]),
    h('div', { position: 'relative', width: 400, height: 400, display: 'flex' }, [
      h('div', { position: 'absolute', left: 61, top: 61, width: 278, height: 278, borderRadius: 139, background: '#FBE1E3' }),
      h('img', { position: 'absolute', left: 61, top: 61, width: 278, height: 278, borderRadius: 139, objectFit: 'cover' }, undefined, { src: dataUri('image/png', input.photoPng), width: 278, height: 278 }),
      h('img', { position: 'absolute', left: 0, top: 0, width: 400, height: 400 }, undefined, { src: dataUri('image/svg+xml', ringSvg({ size: 400 })), width: 400, height: 400 }),
    ]),
  ]);
  const svg = await satori(tree as never, {
    width: 1200, height: 630,
    fonts: [
      { name: 'Schibsted Grotesk', data: input.fonts.medium, weight: 500, style: 'normal' },
      { name: 'Schibsted Grotesk', data: input.fonts.bold, weight: 800, style: 'normal' },
    ],
  });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng());
}
