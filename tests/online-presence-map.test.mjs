import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';

const root = fileURLToPath(new URL('../frontend/', import.meta.url));
const server = await createServer({ root, server: { middlewareMode: true, watch: null }, appType: 'custom' });
try {
  const { buildPresenceMap } = await server.ssrLoadModule('/src/components/OnlinePresenceMap.jsx');
  const map = buildPresenceMap({
    siteUrl: 'https://example.com/marco/', siteTitle: 'Marco',
    foundationPages: [{ title: 'Chi sono', slug: 'chi sono' }],
    posts: [...Array.from({ length: 19 }, (_, index) => ({ id: index, slug: `articolo-${index}`, published: '1', generated_title: `Articolo ${index}` })), { id: 99, published: 0 }],
    sources: [{ id: 1, url: 'https://instagram.com/marco' }, { id: 2 }, { id: 3, url: 'javascript:alert(1)' }],
  });
  assert.equal(map.root.url, 'https://example.com/marco');
  assert.equal(map.groups[0].items[0].url, 'https://example.com/marco/chi%20sono');
  assert.equal(map.groups[1].items.length, 19, 'All published articles remain explorable');
  assert.equal(map.groups[1].items[0].url, 'https://example.com/marco/articolo-0', 'Match public PHP route');
  assert.equal(map.groups[2].items[0].url, 'https://instagram.com/marco');
  assert.equal(map.groups[2].items[1].url, '', 'Missing URLs must not become /undefined');
  assert.equal(map.groups[2].items[2].url, '', 'Unsafe protocols are not clickable');
  assert.deepEqual(buildPresenceMap({}).groups.map(group => group.items.length), [0, 0, 0]);
  console.log('Online presence map: published items, counts, empty state and public URLs verified.');
} finally {
  await server.close();
}
