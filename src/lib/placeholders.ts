import { frontmatterOf } from './frontmatter';

const FLAG = /^placeholder:\s*['"]?true['"]?\s*(#.*)?$/im;

/** Content files still marked `placeholder: true` (REQ-GATE-03, the launch gate). Markdown
 * files are checked by their frontmatter only, so the word in body text never triggers it. */
export function findPlaceholders(files: { path: string; text: string }[]): string[] {
  return files
    .filter((f) => {
      if (!f.path.endsWith('.md')) return FLAG.test(f.text);
      // Stryker disable next-line StringLiteral: equivalent. Any stand-in for missing frontmatter lacks a "placeholder:" line, so it never matches.
      const frontmatter = frontmatterOf(f.text) ?? '';
      return FLAG.test(frontmatter);
    })
    .map((f) => f.path);
}
