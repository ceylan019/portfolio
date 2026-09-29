import { isRecord } from './guards';

// Tags that can identify a person or place, as returned by exifr.parse() with the gps, tiff
// and exif options enabled (E18).
export const IDENTIFYING_EXIF_KEYS = [
  'latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSPosition',
  'OwnerName', 'CameraOwnerName', 'Artist', 'SerialNumber', 'BodySerialNumber', 'LensSerialNumber',
] as const;

// XMP properties that name the creator or owner, or say where the photo was taken, by
// local name in any namespace (dc:creator, xmpRights:Owner, aux:OwnerName,
// photoshop:City, Iptc4xmpCore:Location and so on). Any property whose local name
// starts with GPS (exif:GPSLatitude and the rest) is identifying too.
export const IDENTIFYING_XMP_KEYS = [
  'creator', 'Owner', 'OwnerName', 'CameraOwnerName', 'Artist', 'Credit', 'CreatorContactInfo',
  'SerialNumber', 'BodySerialNumber', 'LensSerialNumber',
  'City', 'State', 'Sublocation', 'Location', 'LocationCreated', 'LocationShown',
] as const;

// IPTC datasets, by exifr's names, that name the creator or owner or say where the photo
// was taken. IPTC has no GPS; its place fields carry that information instead.
export const IDENTIFYING_IPTC_KEYS = [
  'Byline', 'Credit', 'Contact', 'Writer', 'OwnerID', 'City', 'Sublocation', 'State', 'ContentLocationName',
] as const;

const present = (v: unknown) => v !== undefined && v !== null && v !== '';

export function identifyingExifKeys(tags: Record<string, unknown> | null | undefined): string[] {
  if (!tags) return [];
  return IDENTIFYING_EXIF_KEYS.filter((k) => present(tags[k])).sort();
}

const xmpKeys: readonly string[] = IDENTIFYING_XMP_KEYS;

/** Identifying properties in exifr's parsed XMP (one object per namespace prefix, plus
 * the xmlns map of prefixes to URIs, which holds no properties), as "prefix:name". */
export function identifyingXmpKeys(xmp: Record<string, unknown> | null | undefined): string[] {
  if (!xmp) return [];
  const found: string[] = [];
  for (const [prefix, props] of Object.entries(xmp)) {
    if (prefix === 'xmlns' || !isRecord(props)) continue;
    for (const [name, value] of Object.entries(props)) {
      if ((name.startsWith('GPS') || xmpKeys.includes(name)) && present(value)) found.push(`${prefix}:${name}`);
    }
  }
  return found.sort();
}

export function identifyingIptcKeys(iptc: Record<string, unknown> | null | undefined): string[] {
  if (!iptc) return [];
  return IDENTIFYING_IPTC_KEYS.filter((k) => present(iptc[k])).sort();
}
