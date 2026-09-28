import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { checkContent, checkImage } from '../../scripts/check-content';

const withGpsExif = {
  IFD0: { Artist: 'Ceylan Akyol' },
  IFD3: {
    GPSLatitudeRef: 'N',
    GPSLatitude: '51/1 30/1 3230/100',
    GPSLongitudeRef: 'W',
    GPSLongitude: '0/1 7/1 4366/100',
  },
} as const;

// Real sharp and exifr calls against generated fixtures, no mocking (T9-B). exifr 7.1.3
// cannot parse WebP or AVIF directly, so this is the coverage that proves the sharp-first
// reading path actually catches those formats, not just JPEG.
describe('check-content image privacy (CLI)', () => {
  let dir: string;
  let gpsJpegPath: string;
  let gpsWebpPath: string;
  let cleanWebpPath: string;
  let gpsAvifPath: string;
  let cleanAvifPath: string;
  let corruptedJpegPath: string;
  let unreadablePath: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'check-content-'));

    const withGps = sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
    }).withExif(withGpsExif);

    gpsJpegPath = join(dir, 'gps.jpeg');
    await withGps.clone().jpeg().toFile(gpsJpegPath);

    gpsWebpPath = join(dir, 'gps.webp');
    await withGps.clone().webp().toFile(gpsWebpPath);

    cleanWebpPath = join(dir, 'clean.webp');
    await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .webp()
      .toFile(cleanWebpPath);

    gpsAvifPath = join(dir, 'gps.avif');
    await withGps.clone().avif().toFile(gpsAvifPath);

    cleanAvifPath = join(dir, 'clean.avif');
    await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .avif()
      .toFile(cleanAvifPath);

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

  test('@REQ-PRIV-01 an AVIF with GPS EXIF is rejected', async () => {
    const problem = await checkImage(gpsAvifPath);
    expect(problem).toContain('contains identifying metadata');
    expect(problem).toContain('GPSLatitude');
  });

  test('@REQ-PRIV-01 a clean AVIF passes', async () => {
    expect(await checkImage(cleanAvifPath)).toBeNull();
  });

  test('@REQ-PRIV-01 a file sharp cannot read fails closed instead of passing', async () => {
    expect(await checkImage(unreadablePath)).toBe(`${unreadablePath}: could not read metadata.`);
  });

  test('@REQ-PRIV-01 a corrupted EXIF chunk fails closed instead of passing', async () => {
    expect(await checkImage(corruptedJpegPath)).toBe(`${corruptedJpegPath}: could not read metadata.`);
  });
});

// checkContent() is the CLI's orchestrating function: it walks a content directory for
// images, reads profile/profile.md, and combines both kinds of problems. Each fixture
// below is its own subdirectory of one temp root, so the scenarios cannot leak into each
// other (T9-D, walk() recursion, the missing-frontmatter fail-closed branch).
describe('checkContent (CLI orchestration)', () => {
  let root: string;

  const tagline = 'I build test automation that teams can read, trust and keep running.';

  const writeProfile = async (contentDir: string, raw: string) => {
    await mkdir(join(contentDir, 'profile'), { recursive: true });
    await writeFile(join(contentDir, 'profile/profile.md'), raw, 'utf8');
  };

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'check-content-cli-'));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test('@REQ-CONTENT-03 a profile.md with no frontmatter fence fails closed', async () => {
    const contentDir = join(root, 'no-frontmatter');
    await writeProfile(contentDir, 'Just a body, no frontmatter fence at all.');

    const problems = await checkContent([contentDir]);
    expect(problems).toEqual([`${join(contentDir, 'profile/profile.md')} has no frontmatter. Cannot check the About rules.`]);
  });

  test('@REQ-CONTENT-03 a distinct, short About with valid frontmatter reports nothing', async () => {
    const contentDir = join(root, 'valid');
    await writeProfile(
      contentDir,
      `---\nname: Ceylan Akyol\ntagline: ${tagline}\n---\nFor five years I tested web and API products in small teams.\n`,
    );

    expect(await checkContent([contentDir])).toEqual([]);
  });

  test('@REQ-CONTENT-03 an About that repeats the tagline is reported', async () => {
    const contentDir = join(root, 'repeats-tagline');
    const about = `${tagline} For five years I tested products.`;
    await writeProfile(contentDir, `---\nname: Ceylan Akyol\ntagline: ${tagline}\n---\n${about}\n`);

    const problems = await checkContent([contentDir]);
    expect(problems).toEqual(['About repeats the tagline: "i build test automation that teams can read trust and keep running"']);
  });

  test('@REQ-PRIV-01 an image with GPS EXIF nested inside the content dir is found by walk()', async () => {
    const contentDir = join(root, 'with-image');
    await writeProfile(
      contentDir,
      `---\nname: Ceylan Akyol\ntagline: ${tagline}\n---\nFor five years I tested web and API products in small teams.\n`,
    );
    const nestedDir = join(contentDir, 'photos', 'profile');
    await mkdir(nestedDir, { recursive: true });
    const imagePath = join(nestedDir, 'gps.jpeg');
    await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } } })
      .withExif(withGpsExif)
      .jpeg()
      .toFile(imagePath);

    const problems = await checkContent([contentDir]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(imagePath);
    expect(problems[0]).toContain('contains identifying metadata');
  });
});
