const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/** The single frontmatter parser in the codebase (ruling P27). Every module that reads
 * a Markdown file's YAML frontmatter imports this instead of copying the regex.
 * Returns the frontmatter text (without the fences), or null when the file has none. */
export function frontmatterOf(text: string): string | null {
  return splitFrontmatter(text)?.frontmatter ?? null;
}

/** Splits a Markdown file into its YAML frontmatter and the body that follows it (ruling
 * P27, T9-D). Normalizes CRLF line endings first, the same as frontmatterOf. Returns null
 * when the file has no frontmatter fence, so callers can fail closed instead of treating
 * the whole file as body text. */
export function splitFrontmatter(text: string): { frontmatter: string; body: string } | null {
  const match = FRONTMATTER.exec(text.replace(/\r\n/g, '\n'));
  return match ? { frontmatter: match[1]!, body: match[2] ?? '' } : null;
}
