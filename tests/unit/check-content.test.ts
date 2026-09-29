import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import {
  checkContent, checkImage, checkProfilePhoto, iptcProblemKeys, normalizePhotoFormat, xmpProblemKeys,
} from '../../scripts/check-content';
import { resolvePhotoPath } from '../../src/lib/content-paths';

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

// XMP and IPTC carry the same kinds of data as EXIF (E18). sharp 0.35.5 writes XMP with
// withXmp() for every format; it cannot write IPTC, so that block is built by hand as a
// JPEG APP13 Photoshop resource, the way cameras and editors store it.
const xmpPacket = (props: string) => `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:exif="http://ns.adobe.com/exif/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" ${props}/>
</rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
const XMP_GPS = xmpPacket('exif:GPSLatitude="52,22.1N" exif:GPSLongitude="4,53.6E"');
const XMP_CREATOR = xmpPacket('dc:creator="Jane Doe"');
const XMP_CLEAN = xmpPacket('xmp:CreatorTool="Photos 9.0"');

function iptcJpeg(jpeg: Buffer, datasets: [number, string][]): Buffer {
  const records = Buffer.concat(datasets.map(([tag, value]) => {
    const v = Buffer.from(value, 'latin1');
    return Buffer.concat([Buffer.from([0x1c, 0x02, tag, v.length >> 8, v.length & 0xff]), v]);
  }));
  const size = Buffer.alloc(4); size.writeUInt32BE(records.length);
  const pad = Buffer.alloc(records.length % 2);
  const irb = Buffer.concat([Buffer.from('Photoshop 3.0\0', 'latin1'), Buffer.from('8BIM', 'latin1'), Buffer.from([0x04, 0x04, 0, 0]), size, records, pad]);
  const length = Buffer.alloc(2); length.writeUInt16BE(irb.length + 2);
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xed]), length, irb, jpeg.subarray(2)]);
}

describe('check-content XMP and IPTC privacy', () => {
  let dir: string;
  const blank = () => sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } } });
  const file = (name: string) => join(dir, name);

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'check-content-xmp-'));
    await blank().withXmp(XMP_GPS).jpeg().toFile(file('xmp-gps.jpg'));
    await blank().withXmp(XMP_GPS).webp().toFile(file('xmp-gps.webp'));
    await blank().withXmp(XMP_GPS).png().toFile(file('xmp-gps.png'));
    await blank().withXmp(XMP_CREATOR).avif().toFile(file('xmp-creator.avif'));
    await blank().withXmp(XMP_CLEAN).webp().toFile(file('xmp-clean.webp'));
    await blank().withXmp('this is not an XMP packet').jpeg().toFile(file('xmp-broken.jpg'));
    const jpeg = await blank().jpeg().toBuffer();
    await writeFile(file('iptc-byline.jpg'), iptcJpeg(jpeg, [[0, '\x00\x04'], [80, 'Jane Doe'], [90, 'Amsterdam']]));
    await writeFile(file('iptc-clean.jpg'), iptcJpeg(jpeg, [[0, '\x00\x04'], [25, 'portrait']]));
    // An IPTC resource holding bytes that are not IPTC datasets.
    const broken = iptcJpeg(jpeg, [[80, 'Jane Doe']]);
    const dataset = broken.indexOf(Buffer.from([0x1c, 0x02, 80]));
    broken.fill(0x20, dataset, dataset + 3);
    await writeFile(file('iptc-broken.jpg'), broken);
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('@REQ-PRIV-01 GPS in XMP is rejected in JPEG, WebP and PNG files', async () => {
    for (const name of ['xmp-gps.jpg', 'xmp-gps.webp', 'xmp-gps.png']) {
      expect(await checkImage(file(name))).toBe(
        `${file(name)} contains identifying metadata (XMP exif:GPSLatitude, XMP exif:GPSLongitude). Strip it first: see docs/runbook.md.`,
      );
    }
  });
  test('@REQ-PRIV-01 a creator in XMP is rejected, in AVIF too', async () => {
    expect(await checkImage(file('xmp-creator.avif'))).toContain('(XMP dc:creator)');
  });
  test('@REQ-PRIV-01 XMP without identifying properties passes', async () => {
    expect(await checkImage(file('xmp-clean.webp'))).toBeNull();
  });
  test('@REQ-PRIV-01 an XMP packet exifr cannot parse fails closed', async () => {
    expect(await checkImage(file('xmp-broken.jpg'))).toBe(`${file('xmp-broken.jpg')}: could not read metadata.`);
  });
  test('@REQ-PRIV-01 an IPTC by-line and city are rejected', async () => {
    expect(await checkImage(file('iptc-byline.jpg'))).toContain('(IPTC Byline, IPTC City)');
  });
  test('@REQ-PRIV-01 IPTC without identifying datasets passes', async () => {
    expect(await checkImage(file('iptc-clean.jpg'))).toBeNull();
  });
  test('@REQ-PRIV-01 an IPTC resource exifr cannot read fails closed', async () => {
    expect(await checkImage(file('iptc-broken.jpg'))).toBe(`${file('iptc-broken.jpg')}: could not read metadata.`);
  });
  test('@REQ-PRIV-01 the XMP and IPTC readers parse raw blocks and report null when they cannot', async () => {
    expect(await xmpProblemKeys(Buffer.from(XMP_GPS))).toEqual(['exif:GPSLatitude', 'exif:GPSLongitude']);
    expect(await xmpProblemKeys(Buffer.from(XMP_CLEAN))).toEqual([]);
    expect(await xmpProblemKeys(Buffer.from('<x:xmpmeta><rdf:RDF><rdf:Description exif:GPSLatitude="1'))).toBeNull();
    expect(await xmpProblemKeys(Buffer.alloc(0))).toBeNull();
    const { iptc } = await sharp(file('iptc-byline.jpg')).metadata();
    expect(await iptcProblemKeys(iptc!)).toEqual(['Byline', 'City']);
    // A resource block with no IPTC resource (print settings only, say) has nothing to check.
    expect(await iptcProblemKeys(Buffer.from('Photoshop 3.0\x008BIM\x03\xed\0\0\0\0\0\x10resolution-data!', 'latin1'))).toEqual([]);
    expect(await iptcProblemKeys(Buffer.alloc(0))).toEqual([]);
    // An IPTC resource whose datasets cannot be read fails closed.
    expect(await iptcProblemKeys(Buffer.from('Photoshop 3.0\x008BIM\x04\x04\0\0\0\0\0\x08garbage!', 'latin1'))).toBeNull();
    // Another resource in front of the IPTC one (a thumbnail, say) does not hide it.
    expect(await iptcProblemKeys(Buffer.concat([Buffer.from('Photoshop 3.0\x008BIM\x04\x0c\0\0\0\0\0\x04\x1c\x02\x50\x00', 'latin1'), iptc!.subarray(14)]))).toEqual(['Byline', 'City']);
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

  // A photo that passes photoProblem's own rule (JPG, 800px+ on the short side), so tests
  // that are not about the photo rule itself do not pick up an unrelated photo problem.
  const writeValidPhoto = async (contentDir: string) => {
    await sharp({ create: { width: 800, height: 900, channels: 3, background: { r: 251, g: 225, b: 227 } } })
      .jpeg()
      .toFile(join(contentDir, 'profile/photo.jpg'));
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
      `---\nname: Ceylan Akyol\ntagline: ${tagline}\nphoto: photo.jpg\n---\nFor five years I tested web and API products in small teams.\n`,
    );
    await writeValidPhoto(contentDir);

    expect(await checkContent([contentDir])).toEqual([]);
  });

  test('@REQ-CONTENT-03 an About that repeats the tagline is reported', async () => {
    const contentDir = join(root, 'repeats-tagline');
    const about = `${tagline} For five years I tested products.`;
    await writeProfile(contentDir, `---\nname: Ceylan Akyol\ntagline: ${tagline}\nphoto: photo.jpg\n---\n${about}\n`);
    await writeValidPhoto(contentDir);

    const problems = await checkContent([contentDir]);
    expect(problems).toEqual(['About repeats the tagline: "i build test automation that teams can read trust and keep running"']);
  });

  test('@REQ-PRIV-01 an image with GPS EXIF nested inside the content dir is found by walk()', async () => {
    const contentDir = join(root, 'with-image');
    await writeProfile(
      contentDir,
      `---\nname: Ceylan Akyol\ntagline: ${tagline}\nphoto: photo.jpg\n---\nFor five years I tested web and API products in small teams.\n`,
    );
    await writeValidPhoto(contentDir);
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

  test('@REQ-CONTENT-01 a missing "photo" field fails closed', async () => {
    const contentDir = join(root, 'no-photo-field');
    await writeProfile(
      contentDir,
      `---\nname: Ceylan Akyol\ntagline: ${tagline}\n---\nFor five years I tested web and API products in small teams.\n`,
    );

    const problems = await checkContent([contentDir]);
    expect(problems).toEqual([`${join(contentDir, 'profile/profile.md')}: missing "photo". Cannot check the photo rules.`]);
  });

  // Proves the photoProblem(resolvePhotoPath(...)) call inside checkContent is actually
  // wired up and its result actually reported: deleting that call, or dropping its
  // result, leaves this the one test in the suite that goes red (fix round 1 review).
  test('@REQ-CONTENT-01 a too-small photo fails through checkContent end to end', async () => {
    const contentDir = join(root, 'small-photo');
    await writeProfile(
      contentDir,
      `---\nname: Ceylan Akyol\ntagline: ${tagline}\nphoto: photo.jpg\n---\nFor five years I tested web and API products in small teams.\n`,
    );
    const photoPath = join(contentDir, 'profile/photo.jpg');
    await sharp({ create: { width: 799, height: 1200, channels: 3, background: { r: 251, g: 225, b: 227 } } })
      .jpeg()
      .toFile(photoPath);

    const problems = await checkContent([contentDir]);
    expect(problems).toEqual([`${photoPath}: The photo must be at least 800px on its shorter side (it is 799px).`]);
  });
});

// resolvePhotoPath and checkProfilePhoto are the units content.config.ts's schema guard
// leans on (T13-D): Astro's content-layer glob loader never hands the schema real photo
// metadata, so this is the check that actually fails a build over a bad profile photo.
describe('resolvePhotoPath and checkProfilePhoto (@REQ-CONTENT-01)', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'check-content-photo-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('a relative photo path resolves against profile.md\'s own directory', () => {
    const profilePath = join(dir, 'profile/profile.md');
    expect(resolvePhotoPath(profilePath, '../assets/photo.jpg')).toBe(join(dir, 'assets/photo.jpg'));
  });

  test('a leading-slash photo path resolves against the repo root, not the filesystem root', () => {
    const profilePath = join(dir, 'profile/profile.md');
    expect(resolvePhotoPath(profilePath, '/src/assets/uploads/photo.jpg')).toBe(resolve('src/assets/uploads/photo.jpg'));
  });

  test('a photo 799px on its short side fails', async () => {
    const photoPath = join(dir, 'too-small.jpg');
    await sharp({ create: { width: 799, height: 1200, channels: 3, background: { r: 251, g: 225, b: 227 } } })
      .jpeg()
      .toFile(photoPath);

    expect(await checkProfilePhoto(photoPath)).toBe(`${photoPath}: The photo must be at least 800px on its shorter side (it is 799px).`);
  });

  test('a photo exactly 800px on its short side passes', async () => {
    const photoPath = join(dir, 'exactly-800.jpg');
    await sharp({ create: { width: 800, height: 1200, channels: 3, background: { r: 251, g: 225, b: 227 } } })
      .jpeg()
      .toFile(photoPath);

    expect(await checkProfilePhoto(photoPath)).toBeNull();
  });

  test('a GIF photo fails regardless of size', async () => {
    const photoPath = join(dir, 'photo.gif');
    await sharp({ create: { width: 900, height: 900, channels: 3, background: { r: 251, g: 225, b: 227 } } })
      .gif()
      .toFile(photoPath);

    expect(await checkProfilePhoto(photoPath)).toBe(`${photoPath}: The photo must be JPG, PNG, WebP or AVIF.`);
  });

  test('a missing photo file fails closed', async () => {
    const photoPath = join(dir, 'does-not-exist.jpg');

    expect(await checkProfilePhoto(photoPath)).toBe(`${photoPath}: could not read the profile photo.`);
  });

  // sharp 0.35.5 reports every AVIF as format "heif" with compression "av1", not as
  // "avif" (fix round 1 review, verified locally the same way: sharp({...}).avif()
  // then .metadata() returns { format: "heif", compression: "av1", ... }). Without
  // normalizePhotoFormat this real, valid AVIF photo was rejected.
  test('@REQ-CONTENT-01 an 800px AVIF photo passes', async () => {
    const photoPath = join(dir, 'photo.avif');
    await sharp({ create: { width: 800, height: 900, channels: 3, background: { r: 251, g: 225, b: 227 } } })
      .avif()
      .toFile(photoPath);

    expect(await checkProfilePhoto(photoPath)).toBeNull();
  });

  // A HEIC photo is also reported as format "heif", but with compression "hevc" (sharp's
  // own type comment: "av1 (AVIF) or hevc (HEIC)"), and must stay rejected. sharp's local
  // libheif build cannot encode hevc-compressed HEIF (verified: sharp({...})
  // .heif({ compression: 'hevc' }) throws "heifsave: Unsupported compression"), so a real
  // HEIC file cannot be generated here to exercise checkProfilePhoto end to end.
  // normalizePhotoFormat is tested directly instead, with the exact shape sharp documents
  // for a HEIC file, and with compression absent (an unrecognized non-AVIF heif variant).
  test('@REQ-CONTENT-01 normalizePhotoFormat leaves a HEIC-shaped heif rejected', () => {
    expect(normalizePhotoFormat({ format: 'heif', compression: 'hevc' })).toBe('heif');
    expect(normalizePhotoFormat({ format: 'heif' })).toBe('heif');
  });
});
