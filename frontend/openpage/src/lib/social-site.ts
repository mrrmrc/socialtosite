import type { BlockConfig, SiteConfig } from '../blocks/types'
import { themePresets } from './theme-presets'

type Data = Record<string, unknown>
export interface SiteData { site: Data; posts: Data[]; sources: Data[]; reachability?: { profile?: Data }; user: { id: number; slug: string } }
export function decode(value: unknown): Data {
  if (typeof value === 'string') { try { return JSON.parse(value) || {} } catch { return {} } }
  return value && typeof value === 'object' ? value as Data : {}
}
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
export function safeSiteUrl(value: unknown): string {
  const url = text(value)
  return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(url) ? url : ''
}
export function menuDestination(value: unknown, slug: string): string {
  const url = safeSiteUrl(value)
  const base = `/${encodeURIComponent(slug)}`
  if (url === '/') return base
  if (url.startsWith('/?')) return base + url.slice(1)
  return url || '#sts-dynamic-articles'
}
export function publishedArticles(data: SiteData): Data[] {
  return data.posts.filter(p => Number(p.published) === 1).map(p => ({
    id: p.id, title: text(p.edited_title) || text(p.generated_title),
    excerpt: text(p.edited_excerpt) || text(p.generated_excerpt),
    image: text(p.media_type).toUpperCase() === 'VIDEO' ? '' : safeSiteUrl(p.media_url),
    href: `/${encodeURIComponent(data.user.slug)}/${encodeURIComponent(text(p.slug))}`,
  }))
}
export function refreshArticles(config: SiteConfig, data: SiteData): SiteConfig {
  const refresh = (blocks: BlockConfig[]) => blocks.map(b => b.type === 'articles' ? { ...b, props: { ...b.props, items: publishedArticles(data) } } : b)
  return { ...config, blocks: refresh(config.blocks), pages: config.pages?.map(p => ({ ...p, blocks: refresh(p.blocks) })) }
}
export function completeGeneratedSite(config: SiteConfig, data: SiteData): SiteConfig {
  const fallback = configFromProfile(data)
  const blocks = [...config.blocks]
  for (const type of ['navbar', 'hero', 'articles', 'footer']) {
    if (!blocks.some(b => b.type === type)) {
      const block = fallback.blocks.find(b => b.type === type)!
      if (type === 'navbar') blocks.unshift(block)
      else {
        const footerIndex = blocks.findIndex(b => b.type === 'footer')
        blocks.splice(footerIndex < 0 ? blocks.length : footerIndex, 0, block)
      }
    }
  }
  for (const id of ['sts-about', 'sts-contact']) {
    if (!blocks.some(b => b.id === id)) {
      const block = fallback.blocks.find(b => b.id === id)!
      const index = blocks.findIndex(b => b.type === (id === 'sts-about' ? 'articles' : 'footer'))
      blocks.splice(index < 0 ? blocks.length : index, 0, block)
    }
  }
  const withMenu = blocks.map(b => b.type === 'navbar' ? { ...b, props: { ...b.props, linkUrls: Array.isArray(b.props.linkUrls) ? b.props.linkUrls.map(u => menuDestination(u, data.user.slug)) : fallback.blocks[0].props.linkUrls } } : b)
  return refreshArticles({ ...config, blocks: withMenu, pages: [{ id: 'page-home', name: 'Home', path: '/', blocks: withMenu }] }, data)
}
export function configFromProfile(data: SiteData): SiteConfig {
  const s = data.site
  const presence = data.reachability?.profile || decode(s.reachability_profile)
  const name = text(s.title) || data.user.slug
  const bio = text(s.bio) || text(s.profile_summary) || text(s.role_mission)
  let menu: unknown = s.menu_links
  if (typeof menu === 'string') { try { menu = JSON.parse(menu) } catch { menu = [] } }
  const links = Array.isArray(menu) ? menu.filter(Boolean).map(m => typeof m === 'string' ? { label: m, href: '#sts-dynamic-articles' } : { label: text(m.label || m.title || m.name), href: menuDestination(m.href || m.url, data.user.slug) }).filter(m => m.label) : []
  if (!links.length) links.push({ label: 'Chi sono', href: '#sts-about' }, { label: 'Articoli', href: '#sts-dynamic-articles' }, { label: 'Contatti', href: '#sts-contact' })
  const contacts = [text(presence.email) ? `[Email: ${text(presence.email)}](mailto:${text(presence.email)})` : '', text(presence.phone) ? `[Telefono: ${text(presence.phone)}](tel:${text(presence.phone)})` : '', text(presence.whatsapp) ? `[WhatsApp](https://wa.me/${text(presence.whatsapp).replace(/\D/g, '')})` : '', safeSiteUrl(presence.official_site_url) ? `[Sito ufficiale](${safeSiteUrl(presence.official_site_url)})` : '', safeSiteUrl(presence.business_profile_url) ? `[Profilo Google](${safeSiteUrl(presence.business_profile_url)})` : ''].filter(Boolean)
  const blocks: BlockConfig[] = [
    { id: 'sts-navbar', type: 'navbar', variant: 'default', props: { logo: name, logoImage: safeSiteUrl(s.logo_url), links: links.map(l => l.label), linkUrls: links.map(l => l.href), ctaText: 'Contattami', ctaUrl: '#sts-contact' } },
    { id: 'sts-hero', type: 'hero', variant: s.cover_url ? 'split' : 'minimal', props: { headline: name, subheadline: text(s.hero_tagline) || text(s.role_mission) || bio, heroImage: safeSiteUrl(s.cover_url), primaryCta: text(s.cta_text) || 'Leggi gli articoli', primaryCtaUrl: '#sts-dynamic-articles' } },
    { id: 'sts-about', type: 'content', variant: 'default', props: { body: `## Chi sono\n\n${bio}` } },
    { id: 'sts-articles', type: 'articles', variant: 'grid', props: { title: 'Articoli', items: publishedArticles(data) } },
    { id: 'sts-contact', type: 'content', variant: 'default', props: { body: `## Contatti\n\n${contacts.join('\n\n')}${Array.isArray(presence.service_areas) ? '\n\nTerritori: ' + presence.service_areas.join(', ') : ''}` } },
    { id: 'sts-footer', type: 'footer', variant: 'simple', props: { logo: name, copyright: text(s.footer_text) || name, links: [] } },
  ]
  const theme = { ...themePresets.find(p => p.id === 'ivory')?.theme }
  if (/^#[\da-f]{6}$/i.test(text(s.accent_color))) theme.accent = text(s.accent_color)
  return { name, theme, blocks, pages: [{ id: 'page-home', name: 'Home', path: '/', blocks }] }
}
export function getSiteToken(): string { return localStorage.getItem('sts_token') || localStorage.getItem('token') || '' }
export async function siteRequest(action: string, body?: unknown, signal?: AbortSignal) {
  const token = getSiteToken()
  if (!token) throw new Error('Accedi alla dashboard per modificare il tuo sito.')
  const response = await fetch(`/api/index.php?action=${action}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal })
  const data = await response.json()
  if (!response.ok || data.ok === false || data.error) throw new Error(data.error || 'Impossibile caricare il sito. Riprova.')
  return data
}
