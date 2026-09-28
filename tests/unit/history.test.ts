import { readFileSync } from 'node:fs';
import {
  appendHistory, fetchLiveQuality, resolveHistory, upgradeToCurrent, UPGRADERS, type FetchDeps, type FetchOutcome,
} from '../../src/lib/history';
import { LIMITS, type HistoryPoint } from '../../src/lib/quality-schema';

const valid = () => JSON.parse(readFileSync('tests/fixtures/quality/valid.json', 'utf8'));
const point = (commit: string): HistoryPoint => ({
  commit, date: '2026-09-28T09:00:00Z', testRuns: 320, mutationScore: 100, lighthousePerformance: 100,
});

describe('resolveHistory', () => {
  test('@REQ-QUAL-03 a 404 starts fresh without a warning', () => {
    expect(resolveHistory({ kind: 'not-found' }, valid())).toEqual({ kind: 'fresh', warning: null });
  });
  test('@REQ-QUAL-03 a valid live file is used', () => {
    const r = resolveHistory({ kind: 'ok', body: valid() }, undefined);
    expect(r.kind).toBe('live');
    if (r.kind === 'live') expect(r.history).toHaveLength(12);
  });
  test('@REQ-QUAL-03 an invalid live file falls back to the last main artifact', () => {
    const r = resolveHistory({ kind: 'ok', body: { nope: true } }, valid());
    expect(r.kind).toBe('artifact');
  });
  test('@REQ-QUAL-03 a network error falls back to the artifact', () => {
    expect(resolveHistory({ kind: 'error', reason: 'timeout' }, valid()).kind).toBe('artifact');
  });
  test('@REQ-QUAL-03 no live file and no artifact restarts with a warning naming the reason', () => {
    const r = resolveHistory({ kind: 'error', reason: 'HTTP 503' }, undefined);
    expect(r.kind).toBe('fresh');
    if (r.kind === 'fresh') expect(r.warning).toContain('HTTP 503');
  });
  test('@REQ-QUAL-03 an invalid artifact also restarts with a warning', () => {
    const r = resolveHistory({ kind: 'ok', body: null }, { broken: 1 });
    expect(r).toEqual({ kind: 'fresh', warning: expect.stringContaining('invalid') });
  });
});

describe('upgrades', () => {
  test('@REQ-QUAL-02 the current version passes through', () => {
    expect(upgradeToCurrent(valid())?.schemaVersion).toBe(1);
  });
  test('@REQ-QUAL-02 an unknown older version without an upgrader is rejected', () => {
    const doc = valid(); doc.schemaVersion = 0;
    expect(upgradeToCurrent(doc)).toBeNull();
  });
  test('@REQ-QUAL-02 a registered upgrader is applied', () => {
    const doc = valid(); doc.schemaVersion = 0; delete doc.pipelineSeconds;
    UPGRADERS[0] = (d) => ({ ...d, schemaVersion: 1, pipelineSeconds: 0 });
    try {
      expect(upgradeToCurrent(doc)?.pipelineSeconds).toBe(0);
    } finally {
      delete UPGRADERS[0];
    }
  });
  test('@REQ-QUAL-02 non-objects are rejected', () => {
    expect(upgradeToCurrent('x')).toBeNull();
    expect(upgradeToCurrent(null)).toBeNull();
  });
});

describe('appendHistory', () => {
  test('@REQ-QUAL-03 appends a new commit', () => {
    expect(appendHistory([point('aaaaaaa')], point('bbbbbbb')).map((p) => p.commit)).toEqual(['aaaaaaa', 'bbbbbbb']);
  });
  test('@REQ-QUAL-03 a scheduled rebuild of a recorded commit changes nothing', () => {
    const h = [point('aaaaaaa')];
    expect(appendHistory(h, point('aaaaaaa'))).toEqual(h);
  });
  test('@REQ-QUAL-03 a duplicate commit in a full history changes nothing and drops none', () => {
    const h = Array.from({ length: LIMITS.history }, (_, i) => point(i.toString(16).padStart(7, '0')));
    expect(appendHistory(h, point(h[0]!.commit))).toEqual(h);
  });
  test('@REQ-QUAL-03 exactly the limit is kept without truncation', () => {
    const h = Array.from({ length: LIMITS.history - 1 }, (_, i) => point(i.toString(16).padStart(7, '0')));
    const out = appendHistory(h, point('fffffff'));
    expect(out).toHaveLength(LIMITS.history);
    expect(out[0]!.commit).toBe(h[0]!.commit);
    expect(out[LIMITS.history - 1]!.commit).toBe('fffffff');
  });
  test('@REQ-QUAL-03 keeps only the last 50', () => {
    const h = Array.from({ length: LIMITS.history }, (_, i) => point(i.toString(16).padStart(7, '0')));
    const out = appendHistory(h, point('fffffff'));
    expect(out).toHaveLength(LIMITS.history);
    expect(out[0]!.commit).toBe('0000001');
    expect(out[LIMITS.history - 1]!.commit).toBe('fffffff');
  });
});

describe('fetchLiveQuality', () => {
  const noSleep = async () => {};
  type Response = number | 'hang' | 'throw' | 'invalid' | 'bad-json';
  const deps = (responses: Response[], extra: Partial<FetchDeps> = {}): FetchDeps & { calls: number } => {
    const d = {
      calls: 0,
      sleep: noSleep,
      timeoutMs: 20,
      fetch: (_url: string, init: { signal: AbortSignal }): Promise<{ status: number; json(): Promise<unknown> }> => {
        const r = responses[d.calls++] ?? 500;
        if (r === 'throw') return Promise.reject(new Error('ECONNRESET'));
        if (r === 'hang') {
          return new Promise<never>((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
        }
        if (r === 'bad-json') {
          return Promise.resolve({ status: 200, json: async () => { throw new SyntaxError('bad'); } });
        }
        if (r === 'invalid') {
          return Promise.resolve({ status: 200, json: async () => ({ nope: true }) });
        }
        // A numeric status in the 2xx range is a genuine success and carries a
        // valid body; any other numeric status carries an arbitrary body,
        // since only the 2xx branch ever looks at it.
        const body = r >= 200 && r < 300 ? valid() : { ok: r };
        return Promise.resolve({ status: r, json: async () => body });
      },
      ...extra,
    };
    return d;
  };

  test('@REQ-QUAL-03 200 with a valid body returns ok', async () => {
    expect(await fetchLiveQuality('u', deps([200]))).toEqual({ kind: 'ok', body: valid() });
  });
  test('@REQ-QUAL-03 404 returns not-found without retrying', async () => {
    const d = deps([404, 200]);
    expect(await fetchLiveQuality('u', d)).toEqual({ kind: 'not-found' });
    expect(d.calls).toBe(1);
  });
  test('@REQ-QUAL-03 retries a 5xx and succeeds', async () => {
    const d = deps([503, 200]);
    expect((await fetchLiveQuality('u', d)).kind).toBe('ok');
    expect(d.calls).toBe(2);
  });
  test.each([199, 300])('@REQ-QUAL-03 status %d is outside the 2xx range and is retried', async (status) => {
    const d = deps([status as Response, 200]);
    expect((await fetchLiveQuality('u', d)).kind).toBe('ok');
    expect(d.calls).toBe(2);
  });
  test('@REQ-QUAL-03 status 299 is the top of the 2xx range and succeeds immediately', async () => {
    const d = deps([299]);
    expect(await fetchLiveQuality('u', d)).toEqual({ kind: 'ok', body: valid() });
    expect(d.calls).toBe(1);
  });
  test('@REQ-QUAL-03 a hanging request times out and is reported as timeout after 4 attempts', async () => {
    const d = deps(['hang', 'hang', 'hang', 'hang']);
    expect(await fetchLiveQuality('u', d)).toEqual({ kind: 'error', reason: 'timeout' });
    expect(d.calls).toBe(4);
  });
  test('@REQ-QUAL-03 backs off 1 s, 2 s then 4 s between attempts', async () => {
    const waits: number[] = [];
    const d = deps(['throw', 'throw', 'throw', 'throw'], { sleep: async (ms) => { waits.push(ms); } });
    expect(await fetchLiveQuality('u', d)).toEqual({ kind: 'error', reason: 'ECONNRESET' });
    expect(waits).toEqual([1000, 2000, 4000]);
  });
  test('@REQ-QUAL-03 unparseable JSON is retried and then reported as an error', async () => {
    const d = deps(['bad-json', 'bad-json', 'bad-json', 'bad-json']);
    expect(await fetchLiveQuality('u', d)).toEqual({ kind: 'error', reason: 'invalid JSON' });
    expect(d.calls).toBe(4);
  });
  test('@REQ-QUAL-03 a schema-invalid 200 body is retried and then reported as an error', async () => {
    const d = deps(['invalid', 'invalid', 'invalid', 'invalid']);
    expect(await fetchLiveQuality('u', d)).toEqual({ kind: 'error', reason: 'invalid quality.json' });
    expect(d.calls).toBe(4);
  });
  test('@REQ-QUAL-03 an invalid body followed by a valid one succeeds', async () => {
    const d = deps(['invalid', 200]);
    expect(await fetchLiveQuality('u', d)).toEqual({ kind: 'ok', body: valid() });
    expect(d.calls).toBe(2);
  });
});

// Mutation testing (Task 11).
describe('history edge cases', () => {
  test('@REQ-QUAL-03 only an ok outcome is read as live data, even if another outcome carries a body', () => {
    const errorWithBody = { kind: 'error', reason: 'HTTP 500', body: valid() } as unknown as FetchOutcome;
    expect(resolveHistory(errorWithBody, undefined)).toEqual({ kind: 'fresh', warning: 'History restarted: HTTP 500; no valid previous artifact.' });
  });
  test('@REQ-QUAL-03 an invalid live file with no artifact names the invalid file in the warning', () => {
    expect(resolveHistory({ kind: 'ok', body: null }, undefined))
      .toEqual({ kind: 'fresh', warning: 'History restarted: live quality.json invalid; no valid previous artifact.' });
  });
  test('@REQ-QUAL-02 a schema version that is not a number is never upgraded', () => {
    UPGRADERS[0] = (d) => ({ ...d, schemaVersion: 1 });
    try {
      const doc = valid(); doc.schemaVersion = '0';
      expect(upgradeToCurrent(doc)).toBeNull();
      doc.schemaVersion = 0;
      expect(upgradeToCurrent(doc)?.schemaVersion).toBe(1);
    } finally {
      delete UPGRADERS[0];
    }
  });
  test('@REQ-QUAL-03 a duplicate commit still trims an over-long history to the limit', () => {
    const history = [point('a'), point('b'), point('c')];
    expect(appendHistory(history, point('c'), 2).map((h) => h.commit)).toEqual(['b', 'c']);
  });

  const once = (status: number, body: unknown = valid()) => {
    const d = { calls: 0, sleep: async () => {}, fetch: async () => { d.calls++; return { status: d.calls === 1 ? status : 200, json: async () => body }; } };
    return d;
  };
  test.each([199, 300])('@REQ-QUAL-03 status %d with a valid body is still not a success', async (status) => {
    const d = once(status);
    expect(await fetchLiveQuality('u', d)).toEqual({ kind: 'ok', body: valid() });
    expect(d.calls).toBe(2);
  });
  test('@REQ-QUAL-03 an HTTP failure is reported with its status', async () => {
    const fetch = async () => ({ status: 503, json: async () => valid() });
    expect(await fetchLiveQuality('u', { fetch, sleep: async () => {} })).toEqual({ kind: 'error', reason: 'HTTP 503' });
  });
  test('@REQ-QUAL-03 with no attempts the reason is unknown', async () => {
    const fetch = async () => ({ status: 200, json: async () => valid() });
    expect(await fetchLiveQuality('u', { fetch, sleep: async () => {}, attempts: 0 })).toEqual({ kind: 'error', reason: 'unknown' });
  });
  test('@REQ-QUAL-03 every attempt clears its timeout timer', async () => {
    vi.useFakeTimers();
    try {
      const fetch = async () => ({ status: 503, json: async () => valid() });
      await fetchLiveQuality('u', { fetch, sleep: async () => {}, attempts: 2 });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
