import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { resolveContentPath } from '../../lib/content-paths';

export const getStaticPaths = (async () => {
  const entries = await getCollection('certifications', (e) => !e.data.hidden);
  return entries.flatMap((e) => (e.data.certificate && e.filePath
    ? [{ params: { id: e.id }, props: { file: resolveContentPath(dirname(e.filePath), e.data.certificate) } }]
    : []));
}) satisfies GetStaticPaths;

export async function GET({ props }: { props: { file: string } }) {
  return new Response(await readFile(props.file), { headers: { 'Content-Type': 'application/pdf' } });
}
