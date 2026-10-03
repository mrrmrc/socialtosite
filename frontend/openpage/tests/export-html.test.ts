import { describe, it, expect } from 'vitest'
import { exportSiteToHTML } from '../src/lib/export-html'
import type { SiteConfig } from '../src/blocks/types'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RenderBlock } from '../src/blocks/registry'

const baseConfig: SiteConfig = {
  name: 'Test Site',
  blocks: [
    {
      id: 'hero-1',
      type: 'hero',
      variant: 'centered',
      props: {
        headline: 'Hello',
        subheadline: 'World',
        primaryCta: 'Start',
      },
    },
  ],
}

describe('exportSiteToHTML', () => {
  it('exports the actual editor renderer and compiled CSS with the chosen theme', () => {
    const config: SiteConfig = { ...baseConfig, theme: { accent: '#8844cc', fontDisplay: 'Poppins' }, blocks: [{
      ...baseConfig.blocks[0], variant: 'split', props: { ...baseConfig.blocks[0].props,
        heroImage: 'https://example.com/cover.jpg', primaryCtaUrl: '/customer/contact' },
    }] }
    const html = exportSiteToHTML(config)
    expect(html).toContain(renderToStaticMarkup(createElement(RenderBlock, { block: config.blocks[0] })))
    expect(html).toContain('--color-green:#8844cc')
    expect(html).toContain('--font-display:"Poppins"')
    expect(html).toContain('cover.jpg')
    expect(html).toContain('href="/customer/contact"')
    expect(/container-type:\s*inline-size/.test(html)).toBe(true)
    expect(html).not.toContain('cdn.tailwindcss.com')
    expect(html).not.toContain('@import "tailwindcss"')
    expect(html).toContain('class="scroll-revealed"')
  })

  it('preserves the dynamic article slot and accessible interactive controls', () => {
    const html = exportSiteToHTML({ name: 'Test', blocks: [
      { id: 'nav', type: 'navbar', variant: 'default', props: { logo: 'Test', links: ['Contact'], linkUrls: ['/contact'] } },
      { id: 'articles', type: 'articles', variant: 'grid', props: { title: 'My articles', items: [] } },
      { id: 'faq', type: 'faq', variant: 'default', props: { items: [{ question: 'Why?', answer: 'Because.' }] } },
    ] }, { dynamicArticles: true, settings: { language: 'Italian' } })
    expect(html).toContain('<html lang="it">')
    expect(html).toContain('<div id="sts-dynamic-articles"></div>')
    expect(html).toContain('My articles')
    expect(html).toContain('data-site-menu')
    expect(html).toContain('data-faq-toggle')
    expect(html).toContain("addEventListener('click'")
    expect(html).not.toContain('Gli articoli si aggiornano dal sito')
  })
  it('includes SEO metadata and language settings', () => {
    const html = exportSiteToHTML(baseConfig, {
      settings: {
        siteName: 'OpenPage',
        seoTitle: 'OpenPage Builder',
        seoDescription: 'Build <fast> websites safely',
        ogImageUrl: 'https://cdn.example.com/og.png',
        faviconUrl: 'https://cdn.example.com/favicon.ico',
        language: 'German',
      },
    })

    expect(html).toMatch(/<html lang="de">/)
    expect(html).toMatch(/<title>OpenPage Builder<\/title>/)
    expect(html).toMatch(/name="description" content="Build &lt;fast&gt; websites safely"/)
    expect(html).toMatch(/property="og:image" content="https:\/\/cdn\.example\.com\/og\.png"/)
    expect(html).toMatch(/rel="icon" href="https:\/\/cdn\.example\.com\/favicon\.ico"/)
  })

  it('injects analytics snippets when keys are provided', () => {
    const html = exportSiteToHTML(baseConfig, {
      settings: {
        gaId: 'G-ABC123XYZ',
        posthogKey: 'phc_test_key',
      },
    })

    expect(html).toMatch(/googletagmanager\.com\/gtag\/js\?id=G-ABC123XYZ/)
    expect(html).toMatch(/gtag\('config', "G-ABC123XYZ"\);/)
    expect(html).toMatch(/posthog\.init\("phc_test_key"/)
  })

  it('omits optional metadata when settings are absent', () => {
    const html = exportSiteToHTML(baseConfig)
    expect(html).not.toMatch(/name="description"/)
    expect(html).not.toMatch(/property="og:image"/)
    expect(html).not.toMatch(/googletagmanager/)
    expect(html).not.toMatch(/posthog\.init/)
  })
})
