export interface PersonInput { name: string; jobTitle: string; url: string; image: string; sameAs: string[] }

export function personJsonLd(p: PersonInput): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@type': 'Person', name: p.name, jobTitle: p.jobTitle, url: p.url, image: p.image, sameAs: p.sameAs };
}

/** Escapes "<" so content can never end the surrounding script element (D21). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
