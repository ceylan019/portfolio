// Opens, updates or closes the one monitoring issue for the daily smoke run and the
// weekly link check (REQ-OPS-01, spec D15 and D27). The decisions are the pure
// functions in src/lib/issue-state.ts; this script reads the inputs and calls gh.
//
//   issue-sync smoke <failed:true|false> <detailsFile>
//   issue-sync links <linkinator.json> <siteUrl> <stateIn.json> <stateOut.json>
//
// Link state (ruling P9): while the "Broken external links" issue is open, its body
// holds the state (parseLinkState). With no issue open, the state comes from stateIn,
// the previous run's artifact. stateOut is always written, and a run that refuses to
// judge the links carries the previous state forward unchanged.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { isRecord } from '../src/lib/guards';
import {
  linksAction, nextLinkState, parseLinkState, smokeAction,
  type IssueAction, type LinkState, type OpenIssue,
} from '../src/lib/issue-state';

/** Runs gh with the given arguments and returns its standard output. */
export type Gh = (args: string[]) => string;
interface Log { log: (message: string) => void; error: (message: string) => void }

const openIssue = (gh: Gh, label: string): OpenIssue | null => {
  const list = JSON.parse(gh(['issue', 'list', '--label', label, '--state', 'open', '--json', 'number,body', '--limit', '1'])) as OpenIssue[];
  return list[0] ?? null;
};

const apply = (gh: Gh, log: Log, action: IssueAction, label: string) => {
  if (action.kind === 'open') gh(['issue', 'create', '--title', action.title, '--body', action.body, '--label', label]);
  if (action.kind === 'update') gh(['issue', 'edit', String(action.number), '--body', action.body]);
  if (action.kind === 'close') gh(['issue', 'close', String(action.number), '--comment', action.comment]);
  log.log(`Issue action: ${action.kind}${'number' in action ? ` #${action.number}` : ''}`);
};

/** The artifact file holds a bare LinkState as JSON. It is validated with the same rules
 * as the issue body, by wrapping it in the comment parseLinkState reads. */
function readStateFile(file: string): LinkState | null {
  if (!existsSync(file)) return null;
  try {
    return parseLinkState(`<!-- link-state ${JSON.stringify(JSON.parse(readFileSync(file, 'utf8')))} -->`);
  } catch {
    return null;
  }
}

interface ReportLink { url: string; state: string }
function readReport(file: string): ReportLink[] | null {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  if (!isRecord(data) || !Array.isArray(data.links)) return null;
  const links = data.links as unknown[];
  return links.every((l) => isRecord(l) && typeof l.url === 'string' && typeof l.state === 'string') ? (links as ReportLink[]) : null;
}

function syncLinks(gh: Gh, log: Log, when: string, [reportFile, siteUrl, stateIn, stateOut]: string[]): number {
  if (!reportFile || !siteUrl || !stateIn || !stateOut) {
    log.error('Usage: issue-sync links <linkinator.json> <siteUrl> <stateIn.json> <stateOut.json>');
    return 2;
  }
  const open = openIssue(gh, 'link-alert');
  const fromIssue = open ? parseLinkState(open.body) : null;
  const fromFile = fromIssue ? null : readStateFile(stateIn);
  const prev: LinkState = fromIssue ?? fromFile ?? { failures: {} };
  log.log(`Previous link state: ${fromIssue ? `issue #${open?.number}` : fromFile ? stateIn : 'none, starting fresh'}.`);
  writeFileSync(stateOut, JSON.stringify(prev));

  const refuse = (why: string) => {
    log.error(`${why}; the link state is carried forward unchanged.`);
    return 1;
  };
  const links = readReport(reportFile);
  if (!links) return refuse(`${reportFile} is not a linkinator JSON report`);
  const site = new URL(siteUrl).origin;
  const checked = links.filter((l) => l.state !== 'SKIPPED' && /^https?:/.test(l.url));
  const internal = checked.filter((l) => new URL(l.url).origin === site);
  const external = checked.filter((l) => new URL(l.url).origin !== site);
  // E15: a check counts only if it examined a non-empty, expected set. If the site
  // itself could not be crawled, no external link was really checked this week.
  if (!internal.some((l) => l.state === 'OK')) return refuse(`No page of ${site} loaded, so no external link was checked`);
  if (external.length === 0) return refuse('The crawl found no external links to check');

  const next = nextLinkState(prev, external.map((l) => ({ url: l.url, ok: l.state === 'OK' })));
  writeFileSync(stateOut, JSON.stringify(next));
  log.log(`Checked ${external.length} external links; ${Object.keys(next.failures).length} failed this week.`);
  apply(gh, log, linksAction(next, open, when), 'link-alert');
  return 0;
}

/** Runs one sync and returns the process exit code. */
export function issueSync(argv: string[], gh: Gh, now: Date = new Date(), log: Log = console): number {
  const when = `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  const [mode, ...args] = argv;
  if (mode === 'smoke') {
    const [failed, detailsFile] = args;
    if (failed !== 'true' && failed !== 'false') {
      log.error('Usage: issue-sync smoke <failed:true|false> <detailsFile>');
      return 2;
    }
    const details = detailsFile && existsSync(detailsFile) ? readFileSync(detailsFile, 'utf8').slice(0, 5000) : '';
    apply(gh, log, smokeAction(failed === 'true', openIssue(gh, 'smoke-alert'), details, when), 'smoke-alert');
    return 0;
  }
  if (mode === 'links') return syncLinks(gh, log, when, args);
  log.error('Usage: issue-sync smoke|links ...');
  return 2;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.exitCode = issueSync(process.argv.slice(2), (args) => execFileSync('gh', args, { encoding: 'utf8' }));
}
