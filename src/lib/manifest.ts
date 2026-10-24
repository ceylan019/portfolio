import { isRecord } from './guards';

export type Manifest = Record<string, string>;
export interface ManifestDiff { changed: string[]; missing: string[]; extra: string[] }

const HEX64 = /^[0-9a-f]{64}$/;

/** How a real build's file hashes differ from the tested manifest (REQ-GATE-02). */
export function diffManifest(expected: Manifest, actual: Manifest, ignore: string[] = ['quality.json']): ManifestDiff {
  const skip = new Set(ignore);
  const changed: string[] = [];
  const missing: string[] = [];
  const extra: string[] = [];
  for (const [path, hash] of Object.entries(expected)) {
    if (skip.has(path)) continue;
    if (!Object.hasOwn(actual, path)) missing.push(path);
    else if (actual[path] !== hash) changed.push(path);
  }
  for (const path of Object.keys(actual)) {
    if (!skip.has(path) && !Object.hasOwn(expected, path)) extra.push(path);
  }
  return { changed: changed.sort(), missing: missing.sort(), extra: extra.sort() };
}

/** True only when the artifact matches the manifest exactly (REQ-GATE-02, the deploy gate). */
export function manifestMatches(d: ManifestDiff): boolean {
  return d.changed.length === 0 && d.missing.length === 0 && d.extra.length === 0;
}

/** Parses a manifest file: a JSON object mapping relative paths to lowercase SHA-256 hex
 * hashes. Anything else, including an empty object, is not a manifest and returns null. */
export function parseManifest(text: string): Manifest | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Not JSON: data stays undefined, and the isRecord check below returns null.
  }
  if (!isRecord(data)) return null;
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  for (const [, v] of entries) if (typeof v !== 'string' || !HEX64.test(v)) return null;
  return data as Manifest;
}
