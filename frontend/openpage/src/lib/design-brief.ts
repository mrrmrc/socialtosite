import type { SiteConfig } from '../blocks/types'
import { blockMetadata } from './block-metadata'
export interface DesignBriefValue { description: string; references: string }
export function parseDesignReferences(value: string): string[] {
  const links = [...new Set(value.split(/\r?\n/).map(v => v.trim()).filter(Boolean))]
  if (links.length > 3) throw new Error('Inserisci al massimo tre link, uno per riga.')
  return links.map(link => {
    let url: URL
    try { url = new URL(link) } catch { throw new Error('Inserisci link completi, ad esempio https://esempio.it.') }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Usa link pubblici HTTP o HTTPS senza credenziali.')
    return url.href
  })
}
// An AI design proposal may change presentation, never customer content or block identities.
export function applyGeneratedPresentation(original: SiteConfig, generated: SiteConfig): SiteConfig {
  if (!generated.theme) throw new Error('La proposta non contiene uno stile valido. La bozza attuale è conservata.')
  const transform = (blocks: SiteConfig['blocks'], candidates: SiteConfig['blocks']) => {
    const occurrences: Record<string,number> = {}
    return blocks.map(block => {
      const position = occurrences[block.type] || 0
      occurrences[block.type] = position + 1
      // AI proposals often use new IDs. Match presentation by type/position as fallback.
      const candidate = candidates.find(b => b.id === block.id && b.type === block.type) || candidates.filter(b => b.type === block.type)[position]
      const allowed = blockMetadata.find(m => m.type === block.type)?.variants || []
      return candidate && allowed.includes(candidate.variant) ? { ...block, variant: candidate.variant } : block
    })
  }
  const pages = original.pages?.map(page => ({ ...page, blocks: transform(page.blocks, (generated.pages?.find(p=>p.id===page.id || p.path===page.path)?.blocks) || generated.blocks) }))
  return { ...original, pages, blocks: pages?.find(page=>page.path==='/')?.blocks || transform(original.blocks,generated.blocks), theme: { ...original.theme, ...generated.theme } }
}
