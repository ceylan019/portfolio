const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

/** The single frontmatter parser in the codebase (ruling P27). Every module that reads
 * a Markdown file's YAML frontmatter imports this instead of copying the regex.
 * Returns the frontmatter text (without the fences), or null when the file has none. */
export function frontmatterOf(text: string): string | null {
  const match = FRONTMATTER.exec(text.replace(/\r\n/g, '\n'));
  return match ? match[1]! : null;
}
