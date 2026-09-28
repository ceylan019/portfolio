// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { hydrate, loadQuality, type FetchLike } from '../../src/lib/quality-client';
import { LIMITS } from '../../src/lib/quality-schema';

const text = (name: string) => readFileSync(`tests/fixtures/quality/${name}.json`, 'utf8');
const fetchJson = (body: string, ok = true): FetchLike => async () => ({ ok, json: async () => JSON.parse(body) });
const block = (name: string) => {
  const div = document.createElement('div');
  div.dataset.block = name; div.dataset.state = 'unavailable';
  const fallback = document.createElement('div'); fallback.dataset.slot = 'fallback'; fallback.textContent = 'fallback';
  const live = document.createElement('div'); live.dataset.slot = 'live';
  div.append(fallback, live); document.body.append(div); return div;
};
beforeEach(() => { document.body.replaceChildren(); });

test('@REQ-QUAL-01 loads and validates the valid fixture', async () => {
  expect((await loadQuality(fetchJson(text('valid'))))?.counts.testRuns).toBe(312);
});
test('@REQ-QUAL-01 returns null on HTTP errors, bad JSON, invalid and future data, and thrown fetches', async () => {
  expect(await loadQuality(fetchJson(text('valid'), false))).toBeNull();
  expect(await loadQuality(fetchJson(text('malformed')))).toBeNull();
  expect(await loadQuality(fetchJson(text('future')))).toBeNull();
  expect(await loadQuality(async () => { throw new TypeError('offline'); })).toBeNull();
});
test('@REQ-QUAL-01 hydrate marks blocks ready and settled on success', async () => {
  const a = block('a');
  await hydrate(document, { a: (live, d) => { live.textContent = String(d.counts.testRuns); } }, fetchJson(text('valid')));
  expect(a.dataset.state).toBe('ready');
  expect(a.dataset.settled).toBe('true');
  expect(a.querySelector('[data-slot="live"]')!.textContent).toBe('312');
});
test('@REQ-QUAL-01 hydrate leaves blocks unavailable but settled when data fails', async () => {
  const a = block('a');
  await hydrate(document, { a: () => {} }, fetchJson(text('malformed')));
  expect(a.dataset.state).toBe('unavailable');
  expect(a.dataset.settled).toBe('true');
});
test('@REQ-QUAL-01 one failing renderer does not affect other blocks', async () => {
  const bad = block('bad'); const good = block('good');
  await hydrate(document, {
    bad: (l) => { l.append(document.createElement('span')); throw new Error('boom'); },
    good: (l) => { l.textContent = 'ok'; },
  }, fetchJson(text('valid')));
  expect(bad.dataset.state).toBe('unavailable');
  expect(bad.dataset.settled).toBe('true');
  expect(bad.querySelector('[data-slot="live"]')!.childElementCount).toBe(0);
  expect(good.dataset.state).toBe('ready');
});
test('@REQ-QUAL-01 blocks without a renderer settle as unavailable', async () => {
  const x = block('unknown');
  await hydrate(document, {}, fetchJson(text('valid')));
  expect(x.dataset.state).toBe('unavailable');
  expect(x.dataset.settled).toBe('true');
});
test('@REQ-QUAL-01 no blocks means no request', async () => {
  let calls = 0;
  await hydrate(document, {}, async () => { calls++; return { ok: true, json: async () => ({}) }; });
  expect(calls).toBe(0);
});

// T10-A: hostile.json is schema-invalid (negative, huge and wrong-type values), so the
// loader must reject it outright and the affected block stays unavailable, settled.
test('@REQ-SEC-02 hostile fixture fails validation and yields no data', async () => {
  expect(await loadQuality(fetchJson(text('hostile')))).toBeNull();
});
test('@REQ-SEC-02 hydrate over the hostile fixture leaves blocks unavailable but settled', async () => {
  const a = block('a');
  await hydrate(document, { a: (live, d) => { live.textContent = String(d.counts.testRuns); } }, fetchJson(text('hostile')));
  expect(a.dataset.state).toBe('unavailable');
  expect(a.dataset.settled).toBe('true');
});

// T10-A: a document whose matrix exceeds LIMITS.requirements is oversized and must be
// rejected the same way, even though every row in it is otherwise schema valid.
test('@REQ-SEC-02 an oversized document exceeds schema limits and yields no data', async () => {
  const valid = JSON.parse(text('valid')) as { matrix: unknown[] };
  const row = valid.matrix[0];
  const oversized = { ...valid, matrix: Array.from({ length: LIMITS.requirements + 1 }, () => row) };
  expect(await loadQuality(fetchJson(JSON.stringify(oversized)))).toBeNull();
});
test('@REQ-SEC-02 hydrate over an oversized document leaves blocks unavailable but settled', async () => {
  const valid = JSON.parse(text('valid')) as { matrix: unknown[] };
  const row = valid.matrix[0];
  const oversized = { ...valid, matrix: Array.from({ length: LIMITS.requirements + 1 }, () => row) };
  const a = block('a');
  await hydrate(document, { a: (live, d) => { live.textContent = String(d.counts.testRuns); } }, fetchJson(JSON.stringify(oversized)));
  expect(a.dataset.state).toBe('unavailable');
  expect(a.dataset.settled).toBe('true');
});
