import { isRecord } from './guards';

/** Decides when the scheduled smoke and weekly link check workflows open, update or
 * close their single GitHub issue (REQ-OPS-01, spec D15). A link is reported only
 * after failing on two consecutive weekly runs, so a first failure has nowhere to
 * live until the "Broken external links" issue exists. Once that issue is open, its
 * body is the source of truth for the per link failure counts: renderLinksBody embeds
 * the full LinkState as a machine-readable HTML comment, and parseLinkState reads it
 * back. Before the issue exists, Task 24's workflow keeps the state as an uploaded
 * artifact from the previous run, not the Actions cache: GitHub evicts cache entries
 * unused for 7 days, which equals the weekly interval, so a count could never reach 2
 * (controller ruling P9). */

export interface OpenIssue { number: number; body: string }
export type IssueAction =
  | { kind: 'none' }
  | { kind: 'open'; title: string; body: string }
  | { kind: 'update'; number: number; body: string }
  | { kind: 'close'; number: number; comment: string };

export const SMOKE_TITLE = 'Live site is failing';
export const LINKS_TITLE = 'Broken external links';

/** Opens, updates or closes the daily "Live site is failing" issue (REQ-OPS-01). */
export function smokeAction(failed: boolean, open: OpenIssue | null, details: string, when: string): IssueAction {
  const body = `The daily live check failed at ${when}.\n\n${details}\n\nRecovery steps: docs/runbook.md`;
  if (failed) return open ? { kind: 'update', number: open.number, body } : { kind: 'open', title: SMOKE_TITLE, body };
  return open ? { kind: 'close', number: open.number, comment: `Passing again at ${when}.` } : { kind: 'none' };
}

export interface LinkState { failures: Record<string, number> }

const STATE_COMMENT = /<!-- link-state (.*?) -->/;

/** Reads the machine-readable state renderLinksBody embeds in the issue body back into
 * a LinkState. Returns null when the comment is absent, its JSON does not parse, or its
 * shape is not a LinkState: not an object, no `failures` object, or a failure count that
 * is not a non-negative integer (REQ-OPS-01, controller ruling P9). */
export function parseLinkState(body: string): LinkState | null {
  const match = body.match(STATE_COMMENT);
  if (!match) return null;
  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }
  if (!isRecord(data) || !isRecord(data.failures)) return null;
  for (const count of Object.values(data.failures)) {
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return null;
  }
  return { failures: data.failures as Record<string, number> };
}

/** Applies one week's check results on top of the previous state: a failing URL's count
 * goes up by one, a passing or unchecked URL keeps no count at all (REQ-OPS-01). */
export function nextLinkState(prev: LinkState, results: { url: string; ok: boolean }[]): LinkState {
  const failures: Record<string, number> = {};
  for (const r of results) if (!r.ok) failures[r.url] = (prev.failures[r.url] ?? 0) + 1;
  return { failures };
}

/** URLs that have failed on at least two consecutive weekly runs, sorted (REQ-OPS-01). */
export function reportableLinks(state: LinkState): string[] {
  return Object.entries(state.failures).filter(([, n]) => n >= 2).map(([url]) => url).sort();
}

/** Renders the "Broken external links" issue body: a human-readable list of the
 * currently reportable links, followed by the full LinkState as a machine-readable
 * HTML comment so the next run can recover every count, including links that have
 * not yet failed twice in a row (REQ-OPS-01, controller ruling P9). */
export function renderLinksBody(state: LinkState): string {
  const lines = reportableLinks(state).map((url) => `- ${url} (failed ${state.failures[url]} weekly checks in a row)`);
  const human = `These external links failed on at least two weekly checks in a row:\n\n${lines.join('\n')}\n\nFix the link in the content file, or remove it if the issuer retired it.`;
  return `${human}\n\n<!-- link-state ${JSON.stringify(state)} -->`;
}

/** Opens, updates or closes the "Broken external links" issue (REQ-OPS-01). */
export function linksAction(state: LinkState, open: OpenIssue | null, when: string): IssueAction {
  if (reportableLinks(state).length > 0) {
    const body = renderLinksBody(state);
    return open ? { kind: 'update', number: open.number, body } : { kind: 'open', title: LINKS_TITLE, body };
  }
  return open ? { kind: 'close', number: open.number, comment: `All external links passed or recovered at ${when}.` } : { kind: 'none' };
}
