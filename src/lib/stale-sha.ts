/** Reads one ref's SHA out of `git ls-remote` output (REQ-GATE-04). */
export function parseLsRemote(output: string, ref = 'refs/heads/main'): string | null {
  for (const line of output.split('\n')) {
    const [sha, name] = line.trim().split(/\s+/);
    if (name === ref && sha) return sha;
  }
  return null;
}

/** A newer commit reached main while this run was in flight (E17 deploy guard, REQ-GATE-04). */
export function isStale(runSha: string, headSha: string | null): boolean {
  return headSha !== null && headSha !== runSha;
}
