// Shared by render-home.ts and render-quality.ts (both pages' client renderers),
// so neither page's script has to reach into the other's renderer module just
// for a count-formatting helper.
const nf = new Intl.NumberFormat('en-US');

export function plural(n: number, one: string, many: string): string {
  return `${nf.format(n)} ${n === 1 ? one : many}`;
}

export function curlyQuotes(text: string): string {
  return text
    .replace(/(^|[\s(])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s(])'/g, '$1‘')
    .replace(/'/g, '’');
}
