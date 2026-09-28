/** Shared object guard (P27): one copy, used by every module that needs to
 * narrow an unknown JSON value to a plain record before reading fields. */
export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
