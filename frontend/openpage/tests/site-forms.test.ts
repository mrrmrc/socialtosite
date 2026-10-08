import { describe, expect, it } from 'vitest'
import { exportSiteToHTML } from '../src/lib/export-html'
import { formDestination, safeFormUrl } from '../src/lib/site-forms'
import { blockMetadata } from '../src/lib/block-metadata'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

describe('Visitor forms and component availability', () => {
  it('exports every registered component and variant without placeholders', () => {
    for (const meta of blockMetadata) for (const variant of meta.variants) {
      const html = exportSiteToHTML({ name: 'Test', blocks: [{ id: 'test', type: meta.type, variant, props: meta.defaultProps }] })
      expect(html).not.toContain('block (coming soon)')
      expect(html).not.toContain('Failed to render')
    }
  })
  it('requires an unchecked privacy acknowledgement in contact and newsletter exports', () => {
    for (const type of ['contact', 'newsletter'] as const) {
      const html = exportSiteToHTML({ name: 'Test', blocks: [{ id: type, type, variant: 'form', props: { privacyUrl: '/privacy', recipientEmail: 'owner@example.com', submitUrl: '/submit' } }] })
      const checkbox = html.match(/<input[^>]*name="privacy_acknowledged"[^>]*>/)?.[0] || ''
      expect(checkbox).toContain('required=""')
      expect(checkbox).not.toContain('checked')
      expect(html).toContain('href="/privacy"')
      expect(html).toContain('action="/submit"')
      expect(html).toContain('method="post"')
    }
  })
  it('does not enable unconfigured forms or accept executable destinations', () => {
    expect(formDestination({}, 'contact').ready).toBe(false)
    expect(formDestination({ recipientEmail: 'owner@example.com' }, 'contact').ready).toBe(false)
    expect(formDestination({ privacyUrl: '/privacy', recipientEmail: 'owner@example.com' }, 'newsletter').ready).toBe(false)
    for (const url of ['javascript:alert(1)', '//evil.test', '/\\evil.test', 'https://bad.test\n/path']) expect(safeFormUrl(url)).toBe('')
    expect(formDestination({ privacyUrl: '/privacy', recipientEmail: 'owner@example.com?subject=injected' }, 'contact').ready).toBe(false)
  })
  it('keeps privacy and footer links usable in every footer layout', () => {
    for (const variant of ['simple', 'minimal', 'multi-column']) {
      const html = exportSiteToHTML({ name: 'Test', blocks: [{ id: 'footer', type: 'footer', variant, props: { logo: 'Test', copyright: 'Test', links: ['Privacy'], linkUrls: ['/privacy'], columns: [{ title: 'Informazioni', links: ['Privacy'], linkUrls: ['/privacy'] }] } }] })
      expect(html).toContain('href="/privacy"')
    }
  })
  it('blocks invalid submissions and hands valid contact messages to the email client without claiming delivery', () => {
    let submit: (event: { preventDefault(): void }) => void = () => {}
    const status = { textContent: '' }
    let valid = false
    const form = { dataset: { formReady: 'true', recipient: 'owner@example.com' }, querySelector: () => status, reportValidity: () => valid, hasAttribute: () => false, addEventListener: (_: string, handler: typeof submit) => { submit = handler } }
    const location = { href: '' }
    const source = readFileSync(new URL('../src/lib/site-interactions.js', import.meta.url), 'utf8')
    runInNewContext(source, { document: { querySelector: () => null, querySelectorAll: (selector: string) => selector === 'form[data-site-form]' ? [form] : [] }, window: { location }, FormData: class { get(key: string) { return ({ name: 'Test', email: 'visitor@example.com', message: 'Una domanda' } as Record<string,string>)[key] } } })
    let prevented = false
    submit({ preventDefault: () => { prevented = true } })
    expect(prevented).toBe(true)
    expect(location.href).toBe('')
    valid = true
    submit({ preventDefault: () => {} })
    expect(location.href).toContain('mailto:owner%40example.com?subject=')
    expect(location.href).toContain('Una%20domanda')
    expect(status.textContent).toContain('non ha ancora inviato')
  })
})
