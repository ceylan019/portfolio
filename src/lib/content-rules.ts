export const MAX_ABOUT_WORDS = 90;

const stripMarkdown = (text: string) =>
  text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`#>]/g, ' ');

export function wordCount(text: string): number {
  // Empty tokens from repeated whitespace have no letter or digit, so the filter drops them.
  const tokens = stripMarkdown(text).split(/\s/);
  return tokens.filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

/** Lowercased sentences of 3 or more words, punctuation removed, for overlap checks. */
export function sentences(text: string): string[] {
  // Repeated or final punctuation left on a piece is stripped by the next step.
  const pieces = stripMarkdown(text).split(/[.!?]\s/);
  return pieces
    .map((s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim())
    .filter((s) => s.split(' ').length >= 3);
}

export function aboutProblems(about: string, tagline: string): string[] {
  const problems: string[] = [];
  const taglineSentences = new Set(sentences(tagline));
  for (const s of sentences(about)) {
    if (taglineSentences.has(s)) problems.push(`About repeats the tagline: "${s}"`);
  }
  const words = wordCount(about);
  if (words > MAX_ABOUT_WORDS) problems.push(`About has ${words} words; the limit is ${MAX_ABOUT_WORDS}.`);
  return problems;
}
