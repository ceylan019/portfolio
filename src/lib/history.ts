import {
  LIMITS, SCHEMA_VERSION, parseQualityReport, type HistoryPoint, type QualityReport,
} from './quality-schema';
import { isRecord } from './guards';

export type FetchOutcome =
  | { kind: 'ok'; body: unknown }
  | { kind: 'not-found' }
  | { kind: 'error'; reason: string };

type Doc = Record<string, unknown>;

/** Upgrader for version n produces version n + 1. Empty while the schema is at v1 (D28). */
export const UPGRADERS: Record<number, (doc: Doc) => Doc> = {};

export function upgradeToCurrent(raw: unknown): QualityReport | null {
  if (!isRecord(raw)) return null;
  let doc = raw;
  while (typeof doc.schemaVersion === 'number' && doc.schemaVersion < SCHEMA_VERSION) {
    const upgrade = UPGRADERS[doc.schemaVersion];
    if (!upgrade) return null;
    doc = upgrade(doc);
  }
  const parsed = parseQualityReport(doc);
  return parsed.ok ? parsed.data : null;
}

export type HistorySource =
  | { kind: 'live' | 'artifact'; history: HistoryPoint[] }
  | { kind: 'fresh'; warning: string | null };

/**
 * E19: a 404 means no history yet. Any other failure falls back to the last
 * successful main run's artifact, and only then restarts with a warning.
 * fetchLiveQuality already validates a 2xx body before returning it as ok, but
 * this revalidates as defense in depth against a caller passing a raw body.
 */
export function resolveHistory(live: FetchOutcome, artifact: unknown): HistorySource {
  if (live.kind === 'not-found') return { kind: 'fresh', warning: null };
  if (live.kind === 'ok') {
    const current = upgradeToCurrent(live.body);
    if (current) return { kind: 'live', history: current.history };
  }
  const fallback = upgradeToCurrent(artifact);
  if (fallback) return { kind: 'artifact', history: fallback.history };
  const why = live.kind === 'error' ? live.reason : 'live quality.json invalid';
  return { kind: 'fresh', warning: `History restarted: ${why}; no valid previous artifact.` };
}

/** One point per commit (G4); keeps the newest `limit`. */
export function appendHistory(history: HistoryPoint[], point: HistoryPoint, limit: number = LIMITS.history): HistoryPoint[] {
  if (history.some((h) => h.commit === point.commit)) return history.slice(-limit);
  return [...history, point].slice(-limit);
}

export interface FetchDeps {
  fetch(url: string, init: { signal: AbortSignal }): Promise<{ status: number; json(): Promise<unknown> }>;
  sleep(ms: number): Promise<void>;
  timeoutMs?: number;
  attempts?: number;
}

/**
 * Spec section 8 / controller ruling P22: on any failure other than a 404,
 * retry 3 times with backoff (1 initial attempt plus 3 retries, 4 total;
 * 1000, 2000, 4000 ms backoff). A 2xx response whose body is not valid JSON,
 * or whose parsed body fails upgradeToCurrent, counts as a failed attempt and
 * is retried the same way. Only after the last attempt does it settle on
 * { kind: 'error' } so the caller can fall back to the last artifact (E19).
 */
export async function fetchLiveQuality(url: string, deps: FetchDeps): Promise<FetchOutcome> {
  const attempts = deps.attempts ?? 4;
  const timeoutMs = deps.timeoutMs ?? 10_000;
  let reason = 'unknown';
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await deps.sleep(1000 * 2 ** (i - 1));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await deps.fetch(url, { signal: controller.signal });
      if (res.status === 404) return { kind: 'not-found' };
      if (res.status >= 200 && res.status < 300) {
        let body: unknown;
        try {
          body = await res.json();
        } catch {
          reason = 'invalid JSON';
          continue;
        }
        if (upgradeToCurrent(body)) return { kind: 'ok', body };
        reason = 'invalid quality.json';
        continue;
      }
      reason = `HTTP ${res.status}`;
    } catch (error) {
      reason = controller.signal.aborted ? 'timeout' : error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timer);
    }
  }
  return { kind: 'error', reason };
}
