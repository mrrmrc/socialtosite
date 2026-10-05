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
  const candidates = [...generated.blocks, ...(generated.pages || []).flatMap(p => p.blocks)]
  const transform = (blocks: SiteConfig['blocks']) => blocks.map(block => {
    const candidate = candidates.find(b => b.id === block.id && b.type === block.type)
    const allowed = blockMetadata.find(m => m.type === block.type)?.variants || []
    return candidate && allowed.includes(candidate.variant) ? { ...block, variant: candidate.variant } : block
  })
  const pages = original.pages?.map(page => ({ ...page, blocks: transform(page.blocks) }))
  return { ...original, pages, blocks: transform(original.blocks), theme: { ...original.theme, ...generated.theme } }
}
