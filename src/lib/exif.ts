// Tags that can identify a person or place, as returned by exifr.parse() with the gps, tiff
// and exif options enabled (E18).
export const IDENTIFYING_EXIF_KEYS = [
  'latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSPosition',
  'OwnerName', 'CameraOwnerName', 'Artist', 'SerialNumber', 'BodySerialNumber', 'LensSerialNumber',
] as const;

export function identifyingExifKeys(tags: Record<string, unknown> | null | undefined): string[] {
  if (!tags) return [];
  return IDENTIFYING_EXIF_KEYS
    .filter((k) => {
      const v = tags[k];
      return v !== undefined && v !== null && v !== '';
    })
    .sort();
}
