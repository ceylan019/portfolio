import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { liveMismatches, REQUEST_TIMEOUT_MS } from '../../scripts/live-check';
import { sha256 } from '../../scripts/node-fs';

// A local server with one good file, one changed file and one that never answers.
describe('live file check', () => {
  let server: Server;
  let url: string;
  const good = Buffer.from('<h1>ok</h1>');

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/index.html') res.end(good);
      else if (req.url === '/changed.html') res.end('<h1>changed</h1>');
      // /hang.html: headers are never sent, like a stalled edge.
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  test('@REQ-DEPLOY-01 a request that hangs is recorded as a mismatch instead of stalling the check', async () => {
    const manifest = { 'index.html': sha256(good), 'hang.html': sha256(good), _headers: sha256(good) };
    const started = Date.now();
    const { paths, mismatches } = await liveMismatches(manifest, url, 200);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(paths).toEqual(['index.html', 'hang.html']);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatch(/^hang\.html \(request failed: /);
  });

  test('@REQ-DEPLOY-01 matching files pass, and changed or missing files are named', async () => {
    const manifest = { 'index.html': sha256(good), 'changed.html': sha256(good) };
    expect(await liveMismatches(manifest, url.replace(/\/$/, ''), 2_000)).toEqual({
      paths: ['index.html', 'changed.html'], mismatches: ['changed.html (content differs)'],
    });
  });

  test('@REQ-DEPLOY-01 each request is limited to 20 seconds by default', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(20_000);
  });
});
