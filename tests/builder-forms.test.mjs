import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js'

const root = fileURLToPath(new URL('../frontend/', import.meta.url))
const server = await createServer({ root, configFile: root + 'vite.config.js', server: { middlewareMode: true, watch: null }, appType: 'custom' })
try {
  const { exportSiteToHTML } = await server.ssrLoadModule('/src/openpage/lib/export-html.ts')
  const { formDestination } = await server.ssrLoadModule('/src/openpage/lib/site-forms.ts')
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
  for (const variant of ['simple', 'minimal', 'multi-column']) {
    const html=exportSiteToHTML(config([{ id: 'footer', type: 'footer', variant, props: { links: ['Privacy'], linkUrls: ['/privacy'], columns: [{title:'Informazioni',links:['Privacy'],linkUrls:['/privacy']}] } }]))
    assert.match(html, /href="\/privacy"/)
  }
  console.log('Production builder: contact, newsletter, validation and all footer variants passed.')
} finally { await server.close() }
