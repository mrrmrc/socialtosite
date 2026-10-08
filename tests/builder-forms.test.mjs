import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js'

const root = fileURLToPath(new URL('../frontend/', import.meta.url))
const server = await createServer({ root, configFile: root + 'vite.config.js', server: { middlewareMode: true, watch: null }, appType: 'custom' })
try {
  const { exportSiteToHTML } = await server.ssrLoadModule('/src/openpage/lib/export-html.ts')
  const { formDestination } = await server.ssrLoadModule('/src/openpage/lib/site-forms.ts')
  const { previewPage } = await server.ssrLoadModule('/src/openpage/lib/preview-navigation.ts')
  const draftPages = [{ id: 'home', path: '/', blocks: [] }, { id: 'second', path: '/lalsa', blocks: [] }]
  assert.equal(previewPage('/marco/lalsa', draftPages, 'https://example.com', 'https://example.com/marco')?.id, 'second')
  assert.equal(previewPage('/marco', draftPages, 'https://example.com', 'https://example.com/marco')?.id, 'home')
  assert.equal(previewPage('https://external.example/lalsa', draftPages, 'https://example.com'), undefined)
  assert.equal(previewPage('http://[', draftPages, 'https://example.com'), undefined)
  const { useConfigStore } = await server.ssrLoadModule('/src/openpage/store/configStore.ts')
  const home = { id: 'home', name: 'Home', path: '/', blocks: [{ id: 'home-content', type: 'content', variant: 'prose', props: {} }] }
  const lalsa = { id: 'lalsa', name: 'LALSA', path: '/lalsa', blocks: [] }
  useConfigStore.getState().setConfig({ name: 'Deletion check', pages: [home, lalsa], blocks: home.blocks })
  useConfigStore.getState().setActivePage('lalsa')
  useConfigStore.getState().removePage('lalsa')
  assert.deepEqual(useConfigStore.getState().config.pages.map(page => page.id), ['home'])
  assert.equal(useConfigStore.getState().activePageId, 'home')
  useConfigStore.getState().undo()
  assert.deepEqual(useConfigStore.getState().config.pages.map(page => page.id), ['home', 'lalsa'])
  useConfigStore.getState().removePage('lalsa')
  useConfigStore.getState().removePage('home')
  assert.equal(useConfigStore.getState().config.pages.length, 1)
  const config = blocks => ({ theme: 'light', blocks })
  for (const type of ['contact', 'newsletter']) {
    const html = exportSiteToHTML(config([{ id: type, type, variant: type === 'contact' ? 'form' : 'simple', props: { privacyUrl: '/privacy', submitUrl: '/send' } }]))
    const checkbox = html.match(/<input[^>]+name="privacy_acknowledged"[^>]*>/)?.[0]
    assert.ok(checkbox)
    assert.match(checkbox, /required/)
    assert.doesNotMatch(checkbox, /checked/)
    assert.match(html, /href="\/privacy"/)
    assert.match(html, /action="\/send" method="post"/)
    assert.match(html, /form\.reportValidity/)
    assert.doesNotMatch(html, /onsubmit="return false"/)
  }
  assert.equal(formDestination({}, 'contact').ready, false)
  assert.equal(formDestination({ privacyUrl: 'javascript:alert(1)', recipientEmail: 'test@example.com' }, 'contact').ready, false)
  assert.equal(formDestination({ privacyUrl: '/privacy', recipientEmail: 'test@example.com' }, 'contact').ready, true)
  assert.equal(formDestination({ privacyUrl: '/privacy', recipientEmail: 'test@example.com' }, 'newsletter').ready, false)
  const featureBlock = { id: 'features', type: 'features', variant: 'alternating', props: { title: 'Progetti', items: [{ title: 'Musica', description: 'Descrizione', icon: 'music' }] } }
  const compactFeatures = exportSiteToHTML(config([featureBlock]))
  assert.match(compactFeatures, /lucide-music/)
  assert.doesNotMatch(compactFeatures, /h-48/)
  featureBlock.props.items[0].image = 'https://example.com/project.jpg'
  assert.match(exportSiteToHTML(config([featureBlock])), /<img[^>]+src="https:\/\/example.com\/project.jpg"/)
  for (const variant of ['simple', 'minimal', 'multi-column']) {
    const html=exportSiteToHTML(config([{ id: 'footer', type: 'footer', variant, props: { links: ['Privacy'], linkUrls: ['/privacy'], columns: [{title:'Informazioni',links:['Privacy'],linkUrls:['/privacy']}] } }]))
    assert.match(html, /href="\/privacy"/)
  }
  console.log('Production builder: contact, newsletter, validation and all footer variants passed.')
} finally { await server.close() }
