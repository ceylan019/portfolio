// Astro 6.4.8's Container API validates its own built-in defaults as if they
// were user config, and those defaults include markdown.gfm and
// markdown.smartypants. Astro then warns that both are deprecated, once per
// test worker, although this project sets neither. Drop exactly that message so
// test output stays readable; every other warning still prints.
const DEPRECATED_MARKDOWN = '[astro] `markdown.gfm` and `markdown.smartypants` are deprecated.';
const warn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].startsWith(DEPRECATED_MARKDOWN)) return;
  warn(...args);
};
