import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { checkImage } from '../../scripts/check-content';

// Real sharp and exifr calls against generated fixtures, no mocking (T9-B). exifr 7.1.3
// cannot parse WebP directly, so this is the coverage that proves the sharp-first reading
// path actually catches a WebP with GPS data, not just JPEG.
describe('check-content image privacy (CLI)', () => {
  let dir: string;
  let gpsJpegPath: string;
  let gpsWebpPath: string;
  let cleanWebpPath: string;
  let corruptedJpegPath: string;
  let unreadablePath: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'check-content-'));

    const withGps = sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
    }).withExif({
      IFD0: { Artist: 'Ceylan Akyol' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '51/1 30/1 3230/100',
        GPSLongitudeRef: 'W',
        GPSLongitude: '0/1 7/1 4366/100',
      },
    });

    gpsJpegPath = join(dir, 'gps.jpeg');
    await withGps.clone().jpeg().toFile(gpsJpegPath);

    gpsWebpPath = join(dir, 'gps.webp');
    await withGps.clone().webp().toFile(gpsWebpPath);

    cleanWebpPath = join(dir, 'clean.webp');
    await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .webp()
      .toFile(cleanWebpPath);

    // A JPEG whose EXIF chunk is present but corrupted past the header, so exifr resolves
    // with an { errors: [...] } object instead of throwing. Both outcomes must fail closed.
    const jpegBytes = await readFile(gpsJpegPath);
    const markerIndex = jpegBytes.indexOf(Buffer.from('Exif\0\0'));
    const corrupted = Buffer.from(jpegBytes);
    const corruptStart = markerIndex + 40;
    for (let i = corruptStart; i < Math.min(corruptStart + 50, corrupted.length - 4); i++) corrupted[i] = 0xff;
    corruptedJpegPath = join(dir, 'gps-corrupted.jpeg');
    await writeFile(corruptedJpegPath, corrupted);

    unreadablePath = join(dir, 'not-an-image.jpg');
    await writeFile(unreadablePath, 'this is not an image');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('@REQ-PRIV-01 a JPEG with GPS EXIF is rejected', async () => {
    const problem = await checkImage(gpsJpegPath);
    expect(problem).toContain('contains identifying metadata');
    expect(problem).toContain('GPSLatitude');
  });

  test('@REQ-PRIV-01 a WebP with GPS EXIF is rejected', async () => {
    const problem = await checkImage(gpsWebpPath);
    expect(problem).toContain('contains identifying metadata');
    expect(problem).toContain('GPSLatitude');
  });

  test('@REQ-PRIV-01 a clean WebP passes', async () => {
    expect(await checkImage(cleanWebpPath)).toBeNull();
  });

  test('@REQ-PRIV-01 a file sharp cannot read fails closed instead of passing', async () => {
    expect(await checkImage(unreadablePath)).toBe(`${unreadablePath}: could not read metadata.`);
  });

  test('@REQ-PRIV-01 a corrupted EXIF chunk fails closed instead of passing', async () => {
    expect(await checkImage(corruptedJpegPath)).toBe(`${corruptedJpegPath}: could not read metadata.`);
  });
});
