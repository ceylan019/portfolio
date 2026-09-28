/** Playwright details object carrying requirement tags: test('x', req('REQ-CV-01'), async ...). */
export function req(...ids: string[]): { tag: string[] } {
  return { tag: ids.map((id) => `@${id}`) };
}
