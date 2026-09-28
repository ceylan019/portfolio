import { frontmatterOf } from './frontmatter';

const FLAG = /^placeholder:\s*['"]?true['"]?\s*$/m;

/** Content files still marked `placeholder: true` (REQ-GATE-03, the launch gate). Markdown
 * files are checked by their frontmatter only, so the word in body text never triggers it. */
export function findPlaceholders(files: { path: string; text: string }[]): string[] {
  return files
    .filter((f) => {
      const scope = f.path.endsWith('.md') ? frontmatterOf(f.text) : f.text;
      return scope !== null && FLAG.test(scope);
    })
    .map((f) => f.path);
}
