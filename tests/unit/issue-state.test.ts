import {
  linksAction, nextLinkState, parseLinkState, renderLinksBody, reportableLinks, smokeAction, LINKS_TITLE, SMOKE_TITLE,
} from '../../src/lib/issue-state';

const when = '2026-09-28 06:17 UTC';

describe('smoke issue', () => {
  test('@REQ-OPS-01 opens on the first failure', () => {
    expect(smokeAction(true, null, 'CV returned 404', when)).toEqual({ kind: 'open', title: SMOKE_TITLE, body: expect.stringContaining('CV returned 404') });
  });
  test('@REQ-OPS-01 updates an open issue while failing', () => {
    expect(smokeAction(true, { number: 7, body: 'old' }, 'still 404', when)).toEqual({ kind: 'update', number: 7, body: expect.stringContaining('still 404') });
  });
  test('@REQ-OPS-01 closes the issue once passing', () => {
    expect(smokeAction(false, { number: 7, body: 'x' }, '', when)).toEqual({ kind: 'close', number: 7, comment: `Passing again at ${when}.` });
  });
  test('@REQ-OPS-01 does nothing when passing with no issue', () => {
    expect(smokeAction(false, null, '', when)).toEqual({ kind: 'none' });
  });
});

describe('link state', () => {
  const a = 'https://issuer.example/a';
  const b = 'https://issuer.example/b';

  test('@REQ-OPS-01 counts consecutive failures and resets on success', () => {
    let s = nextLinkState({ failures: {} }, [{ url: a, ok: false }, { url: b, ok: true }]);
    expect(s.failures).toEqual({ [a]: 1 });
    s = nextLinkState(s, [{ url: a, ok: false }, { url: b, ok: false }]);
    expect(s.failures).toEqual({ [a]: 2, [b]: 1 });
    s = nextLinkState(s, [{ url: a, ok: true }, { url: b, ok: false }]);
    expect(s.failures).toEqual({ [b]: 2 });
  });

  test('@REQ-OPS-01 drops links that are no longer checked', () => {
    expect(nextLinkState({ failures: { [a]: 3 } }, [{ url: b, ok: true }]).failures).toEqual({});
  });

  test('@REQ-OPS-01 only links failing twice in a row are reported, sorted', () => {
    expect(reportableLinks({ failures: { [b]: 2, [a]: 3, 'https://c.example': 1 } })).toEqual([a, b]);
  });

  test('@REQ-OPS-01 exactly two consecutive failures reports, one does not', () => {
    expect(reportableLinks({ failures: { [a]: 2 } })).toEqual([a]);
    expect(reportableLinks({ failures: { [a]: 1 } })).toEqual([]);
  });

  test('@REQ-OPS-01 opens, updates and closes one issue', () => {
    const failing = { failures: { [a]: 2 } };
    expect(linksAction(failing, null, when)).toEqual({ kind: 'open', title: LINKS_TITLE, body: renderLinksBody(failing) });
    expect(linksAction(failing, { number: 3, body: '' }, when)).toEqual({ kind: 'update', number: 3, body: renderLinksBody(failing) });
    expect(linksAction({ failures: { [a]: 1 } }, { number: 3, body: '' }, when)).toEqual({ kind: 'close', number: 3, comment: `All external links passed or recovered at ${when}.` });
    expect(linksAction({ failures: { [a]: 1 } }, null, when)).toEqual({ kind: 'none' });
  });

  test('@REQ-OPS-01 the body lists each reportable link with its failure count', () => {
    const body = renderLinksBody({ failures: { [a]: 2, [b]: 1 } });
    expect(body).toContain(`- ${a} (failed 2 weekly checks in a row)`);
    expect(body).not.toContain(`- ${b} (failed`);
  });

  test('@REQ-OPS-01 the rendered body embeds the full state as a machine-readable comment', () => {
    const state = { failures: { [a]: 2, [b]: 1 } };
    expect(renderLinksBody(state)).toContain('<!-- link-state {');
  });

  test('@REQ-OPS-01 parseLinkState round trips renderLinksBody, including links below the report threshold', () => {
    const state = { failures: { [a]: 2, [b]: 1 } };
    expect(parseLinkState(renderLinksBody(state))).toEqual(state);
  });

  test('@REQ-OPS-01 parseLinkState round trips a state with no reportable links', () => {
    const state = { failures: { [a]: 1 } };
    expect(parseLinkState(renderLinksBody(state))).toEqual(state);
  });

  test('@REQ-OPS-01 parseLinkState returns null when the comment is absent', () => {
    expect(parseLinkState('Just a plain issue body with no embedded state.')).toBeNull();
  });

  test('@REQ-OPS-01 parseLinkState returns null when the embedded JSON is invalid', () => {
    expect(parseLinkState('<!-- link-state {not valid json} -->')).toBeNull();
  });

  test('@REQ-OPS-01 parseLinkState returns null when failures is missing', () => {
    expect(parseLinkState('<!-- link-state {"other":1} -->')).toBeNull();
  });

  test('@REQ-OPS-01 parseLinkState returns null when failures is not an object', () => {
    expect(parseLinkState('<!-- link-state {"failures":[1,2,3]} -->')).toBeNull();
  });

  test('@REQ-OPS-01 parseLinkState returns null when a failure count is negative', () => {
    expect(parseLinkState(`<!-- link-state {"failures":{"${a}":-1}} -->`)).toBeNull();
  });

  test('@REQ-OPS-01 parseLinkState returns null when a failure count is not an integer', () => {
    expect(parseLinkState(`<!-- link-state {"failures":{"${a}":1.5}} -->`)).toBeNull();
  });

  test('@REQ-OPS-01 parseLinkState returns null when a failure count is not a number', () => {
    expect(parseLinkState(`<!-- link-state {"failures":{"${a}":"2"}} -->`)).toBeNull();
  });

  test('@REQ-OPS-01 parseLinkState accepts a zero failure count', () => {
    expect(parseLinkState(`<!-- link-state {"failures":{"${a}":0}} -->`)).toEqual({ failures: { [a]: 0 } });
  });
});
