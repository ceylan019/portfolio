import { parseQualityReport, type QualityReport } from './quality-schema';

export type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
export type Renderer = (live: HTMLElement, data: QualityReport) => void;

export async function loadQuality(fetchFn: FetchLike, url = '/quality.json'): Promise<QualityReport | null> {
  try {
    const res = await fetchFn(url);
    if (!res.ok) return null;
    const parsed = parseQualityReport(await res.json());
    return parsed.ok ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Upgrades server-rendered fallbacks to live numbers (E7, E14, G3):
 *   unavailable (SSR) validated data and a matching renderer take it to ready
 *   every path settles: data-settled="true" is always set, in a finally block
 */
export async function hydrate(root: ParentNode, renderers: Record<string, Renderer>, fetchFn: FetchLike, url?: string): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>('[data-block]')];
  if (blocks.length === 0) return;
  const data = await loadQuality(fetchFn, url);
  for (const block of blocks) {
    const live = block.querySelector<HTMLElement>('[data-slot="live"]');
    try {
      const render = renderers[block.dataset.block ?? ''];
      if (data && render && live) {
        live.replaceChildren();
        render(live, data);
        block.dataset.state = 'ready';
      }
    } catch {
      // A renderer that throws partway may have already appended nodes to the
      // live slot. Clear them so a failure truly keeps the fallback (G3),
      // never a half-built live block.
      live?.replaceChildren();
      block.dataset.state = 'unavailable';
    } finally {
      block.dataset.settled = 'true';
    }
  }
}
