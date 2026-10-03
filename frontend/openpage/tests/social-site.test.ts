import { describe, it, expect, vi, afterEach } from 'vitest'
import { configFromProfile, refreshArticles, completeGeneratedSite, menuDestination, siteRequest, type SiteData } from '../src/lib/social-site'
import { exportSiteToHTML } from '../src/lib/export-html'

const data: SiteData = {
  user: { id: 7, slug: 'marco' },
  site: { title: 'Musica e tecnologia', profile_summary: 'Divulgazione accessibile', hero_tagline: 'Idee da ascoltare', menu_links: '[{"label":"Home","url":"/"},{"label":"Musica","url":"/?tag=musica"}]' },
  reachability: { profile: { email: 'info@example.com', phone: '+39012345678', service_areas: ['Italia'] } },
  sources: [],
  posts: [
    { id: 1, published: 1, edited_title: 'Titolo corretto', generated_title: 'Vecchio titolo', generated_excerpt: 'Un approfondimento', slug: 'musica-ai' },
    { id: 2, published: 0, generated_title: 'Bozza privata', slug: 'bozza' },
  ],
}
afterEach(() => vi.unstubAllGlobals())
describe('SocialToSite integration', () => {
  it('preloads identity, real menu destinations, contacts and published articles', () => {
    const config = configFromProfile(data)
    expect(config.blocks[0].props.links).toEqual(['Home', 'Musica'])
    expect(config.blocks[0].props.linkUrls).toEqual(['/marco', '/marco?tag=musica'])
    expect(config.blocks.find(b => b.type === 'articles')?.props.items).toEqual([expect.objectContaining({ title: 'Titolo corretto', href: '/marco/musica-ai' })])
    const html = exportSiteToHTML(config)
    expect(html).toContain('Divulgazione accessibile')
    expect(html).toContain('href="mailto:info@example.com"')
    expect(html).toContain('href="/marco?tag=musica"')
    expect(html).toContain('id="sts-about"')
    expect(html).toContain('Titolo corretto')
    expect(exportSiteToHTML(config, { dynamicArticles: true })).toContain('<div id="sts-dynamic-articles"></div>')
    expect(html).not.toContain('Bozza privata')
  })
  it('refreshes live articles while preserving all manual design edits on every page', () => {
    const config = configFromProfile(data)
    config.blocks[1].props.headline = 'Il mio titolo personale'
    config.blocks[3].props.title = 'Approfondimenti'
    const refreshed = refreshArticles(config, { ...data, posts: [] })
    expect(refreshed.blocks[1].props.headline).toBe('Il mio titolo personale')
    expect(refreshed.blocks[3].props.title).toBe('Approfondimenti')
    expect(refreshed.blocks[3].props.items).toEqual([])
    expect(refreshed.pages?.[0].blocks[3].props.items).toEqual([])
    expect(config.blocks[3].props.items).toHaveLength(1)
  })
  it('adds the article connection to an AI proposal that omits it', () => {
    const config = completeGeneratedSite({ name: 'Proposta', blocks: [] }, data)
    expect(config.blocks.some(b => b.type === 'articles')).toBe(true)
    expect(config.blocks[0].type).toBe('navbar')
    expect(config.blocks[1].type).toBe('hero')
    expect(config.blocks.at(-1)?.type).toBe('footer')
    expect(config.blocks.some(b => b.id === 'sts-contact')).toBe(true)
    expect(config.blocks.find(b => b.type === 'articles')?.props.items).toHaveLength(1)
  })
  it('rejects unsafe navigation destinations', () => {
    expect(menuDestination('javascript:alert(1)', 'marco')).toBe('#sts-dynamic-articles')
    expect(menuDestination('//evil.example', 'marco')).toBe('#sts-dynamic-articles')
  })
  it('uses the same login token as the dashboard and reports API errors', async () => {
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'sts_token' ? 'customer-token' : null })
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => data })
    vi.stubGlobal('fetch', fetcher)
    await siteRequest('site')
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer customer-token')
    fetcher.mockResolvedValue({ ok: false, json: async () => ({ error: 'Sessione scaduta' }) })
    await expect(siteRequest('site')).rejects.toThrow('Sessione scaduta')
  })
})
