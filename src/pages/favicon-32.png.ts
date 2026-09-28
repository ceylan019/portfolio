import sharp from 'sharp';
import { ringSvg } from '../og/card';

// The 32x32 PNG favicon fallback (spec section 4 "Metadata and previews").
export async function GET() {
  const png = await sharp(Buffer.from(ringSvg({ size: 32 }))).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
