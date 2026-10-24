// DOM builders for client renderers. Text always goes through textContent;
// attributes are limited to a fixed allowlist, and hrefs must be https or root-relative.
// Every anchor gets class "lnk" automatically (base.css gives it the link colour,
// underline and a 44px minimum target height), so renderers never have to remember it.
import { TICK_PATH } from './brush-tick';

const ATTRS = new Set(['class', 'href', 'aria-label', 'datetime', 'aria-hidden', 'hidden']);
const SVG_NS = 'http://www.w3.org/2000/svg';

// A root-relative href must start with a single "/" followed by something other
// than "/" or "\": both "//host/x" and "/\host" are browser tricks that resolve
// to a different, cross-origin host, not a same-site path. Browsers strip tab,
// newline and carriage return from a URL before parsing it, so "/\t/host" would
// become "//host": any of the three anywhere rejects the href.
const STRIPPED_BY_URL_PARSER = /[\t\n\r]/;
function isSafeHref(v: string): boolean {
  if (STRIPPED_BY_URL_PARSER.test(v)) return false;
  if (v.startsWith('https://')) return true;
  if (v.startsWith('/')) {
    const next = v.charAt(1);
    return next !== '/' && next !== '\\';
  }
  return false;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, text?: string, attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text ?? '';
  const resolved: Record<string, string> =
    tag === 'a' ? { ...attrs, class: attrs.class ? `${attrs.class} lnk` : 'lnk' } : attrs;
  for (const [k, v] of Object.entries(resolved)) {
    if (!ATTRS.has(k)) continue;
    if (k === 'href' && !isSafeHref(v)) continue;
    node.setAttribute(k, v);
  }
  return node;
}

export function svgEl(tag: 'svg' | 'path' | 'polyline' | 'circle' | 'line', attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (k !== 'style') node.setAttribute(k, v);
  return node;
}

export function tick(size = 30): SVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 36 30', width: String(size), height: String(Math.round(size * 30 / 36)), class: 'tick', 'aria-hidden': 'true' });
  svg.append(svgEl('path', { d: TICK_PATH, class: 'tick-ink' }));
  return svg;
}
