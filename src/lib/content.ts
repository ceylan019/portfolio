import { getCollection, getEntry, render } from 'astro:content';
import type { Certification } from './certifications';

// Thin wrappers over Astro's content APIs (astro:content is a virtual module,
// unavailable to Stryker's vitest runner outside an Astro build, so this file
// is excluded from mutation testing; see stryker.config.mjs).

export async function loadProfile() {
  const entry = await getEntry('profile', 'profile');
  if (!entry) throw new Error('src/content/profile/profile.md is missing.');
  const { Content } = await render(entry);
  return { data: entry.data, About: Content, aboutText: entry.body ?? '' };
}

export async function loadCertifications(): Promise<Certification[]> {
  const entries = await getCollection('certifications');
  return entries.map((e) => ({ id: e.id, ...e.data }));
}
