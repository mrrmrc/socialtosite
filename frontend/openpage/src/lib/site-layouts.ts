import type { BlockConfig, SiteConfig } from '../blocks/types'
import { themePresets } from './theme-presets'

export const siteLayouts = [
  { id: 'author', name: 'Author', description: 'Portrait, introduction and articles.', theme: 'ivory', hero: 'split', articles: 'grid', nav: 'default', articlesFirst: false },
  { id: 'portfolio', name: 'Creative portfolio', description: 'Central title, images and projects.', theme: 'purple-haze', hero: 'centered', articles: 'grid', nav: 'centered', articlesFirst: false },
  { id: 'magazine', name: 'Magazine', description: 'Editorial opening and articles in a list.', theme: 'clean', hero: 'minimal', articles: 'list', nav: 'default', articlesFirst: true },
  { id: 'business', name: 'Business', description: 'Services, presentation and contacts.', theme: 'ocean', hero: 'split', articles: 'list', nav: 'default', articlesFirst: false },
  { id: 'community', name: 'Association', description: 'Mission, stories and participation.', theme: 'forest', hero: 'gradient', articles: 'grid', nav: 'centered', articlesFirst: false },
] as const
export type SiteLayout = typeof siteLayouts[number]

// Change presentation only: preserve every block, identifier, property and page.
export function applySiteLayout(config: SiteConfig, layout: SiteLayout): SiteConfig {
  const transform = (blocks: BlockConfig[]) => {
    const result = blocks.map(block => ({ ...block, variant: block.type === 'hero' ? layout.hero : block.type === 'navbar' ? layout.nav : block.type === 'articles' ? layout.articles : block.variant }))
    if (layout.articlesFirst) {
      const article = result.findIndex(b => b.type === 'articles')
      const hero = result.findIndex(b => b.type === 'hero')
      if (article > hero && hero >= 0) result.splice(hero + 1, 0, result.splice(article, 1)[0])
    }
    return result
  }
  const pages = config.pages?.map(page => ({ ...page, blocks: transform(page.blocks) }))
  return { ...config, theme: { ...themePresets.find(p => p.id === layout.theme)!.theme }, pages, blocks: pages?.find(p => p.path === '/')?.blocks || transform(config.blocks) }
}
