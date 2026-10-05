import type { BlockConfig, SiteConfig } from '../blocks/types'
import { themePresets } from './theme-presets'

export interface SiteLayout { id: string; name: string; description: string; theme: string; hero: string; articles: string; nav: string; articlesFirst: boolean; category?: string; content?: string; features?: string }
export const siteLayouts: SiteLayout[] = [
  { id: 'author', name: 'Author', description: 'Portrait, introduction and articles.', theme: 'ivory', hero: 'split', articles: 'grid', nav: 'default', articlesFirst: false },
  { id: 'portfolio', name: 'Creative portfolio', description: 'Central title, images and projects.', theme: 'purple-haze', hero: 'centered', articles: 'grid', nav: 'centered', articlesFirst: false },
  { id: 'magazine', name: 'Magazine', description: 'Editorial opening and articles in a list.', theme: 'clean', hero: 'minimal', articles: 'list', nav: 'default', articlesFirst: true },
  { id: 'business', name: 'Business', description: 'Services, presentation and contacts.', theme: 'ocean', hero: 'split', articles: 'list', nav: 'default', articlesFirst: false },
  { id: 'community', name: 'Association', description: 'Mission, stories and participation.', theme: 'forest', hero: 'gradient', articles: 'grid', nav: 'centered', articlesFirst: false },
  {"id":"editorial","name":"Editorial","description":"Portrait, introduction and articles.","theme":"sand","hero":"split","articles":"list","nav":"default","articlesFirst":false,"category":"Personal","content":"highlight","features":"list"},
  {"id":"minimal-author","name":"Minimal author","description":"Editorial opening and articles in a list.","theme":"clean","hero":"minimal","articles":"list","nav":"centered","articlesFirst":true,"category":"Personal","content":"default","features":"list"},
  {"id":"speaker","name":"Speaker","description":"Services, presentation and contacts.","theme":"amber","hero":"centered","articles":"grid","nav":"default","articlesFirst":false,"category":"Personal","content":"highlight","features":"alternating"},
  {"id":"writer","name":"Writer","description":"Portrait, introduction and articles.","theme":"rose","hero":"split","articles":"list","nav":"centered","articlesFirst":false,"category":"Personal","content":"columns","features":"list"},
  {"id":"photography","name":"Photography","description":"Central title, images and projects.","theme":"default","hero":"split","articles":"grid","nav":"centered","articlesFirst":false,"category":"Creative","content":"default","features":"alternating"},
  {"id":"design","name":"Design studio","description":"Central title, images and projects.","theme":"clean","hero":"centered","articles":"grid","nav":"centered","articlesFirst":false,"category":"Creative","content":"columns","features":"grid"},
  {"id":"music","name":"Music and arts","description":"Mission, stories and participation.","theme":"purple-haze","hero":"gradient","articles":"grid","nav":"default","articlesFirst":false,"category":"Creative","content":"highlight","features":"alternating"},
  {"id":"architecture","name":"Architecture","description":"Central title, images and projects.","theme":"slate","hero":"minimal","articles":"list","nav":"default","articlesFirst":false,"category":"Creative","content":"columns","features":"alternating"},
  {"id":"news","name":"Newsroom","description":"Editorial opening and articles in a list.","theme":"clean","hero":"minimal","articles":"grid","nav":"default","articlesFirst":true,"category":"Editorial","content":"columns","features":"list"},
  {"id":"culture","name":"Culture journal","description":"Editorial opening and articles in a list.","theme":"ivory","hero":"centered","articles":"list","nav":"centered","articlesFirst":true,"category":"Editorial","content":"highlight","features":"alternating"},
  {"id":"stories","name":"Stories","description":"Portrait, introduction and articles.","theme":"sand","hero":"split","articles":"grid","nav":"default","articlesFirst":true,"category":"Editorial","content":"default","features":"list"},
  {"id":"tech","name":"Technology","description":"Services, presentation and contacts.","theme":"ocean","hero":"gradient","articles":"grid","nav":"default","articlesFirst":true,"category":"Editorial","content":"columns","features":"grid"},
  {"id":"consulting","name":"Consulting","description":"Services, presentation and contacts.","theme":"slate","hero":"split","articles":"grid","nav":"default","articlesFirst":false,"category":"Business","content":"highlight","features":"list"},
  {"id":"agency","name":"Agency","description":"Central title, images and projects.","theme":"purple-haze","hero":"gradient","articles":"list","nav":"centered","articlesFirst":false,"category":"Business","content":"columns","features":"alternating"},
  {"id":"local","name":"Local business","description":"Services, presentation and contacts.","theme":"amber","hero":"centered","articles":"list","nav":"default","articlesFirst":false,"category":"Business","content":"highlight","features":"grid"},
  {"id":"wellness","name":"Wellness","description":"Services, presentation and contacts.","theme":"forest","hero":"split","articles":"grid","nav":"centered","articlesFirst":false,"category":"Business","content":"default","features":"alternating"},
  {"id":"hospitality","name":"Hospitality","description":"Services, presentation and contacts.","theme":"sand","hero":"split","articles":"grid","nav":"centered","articlesFirst":false,"category":"Business","content":"highlight","features":"alternating"},
  {"id":"education","name":"Education","description":"Mission, stories and participation.","theme":"ocean","hero":"centered","articles":"list","nav":"default","articlesFirst":false,"category":"Community","content":"columns","features":"grid"},
  {"id":"volunteering","name":"Volunteering","description":"Mission, stories and participation.","theme":"forest","hero":"split","articles":"list","nav":"default","articlesFirst":true,"category":"Community","content":"highlight","features":"list"},
  {"id":"events","name":"Events","description":"Mission, stories and participation.","theme":"rose","hero":"gradient","articles":"grid","nav":"centered","articlesFirst":false,"category":"Community","content":"columns","features":"alternating"},
]

// Change presentation only: preserve every block, identifier, property and page.
export function applySiteLayout(config: SiteConfig, layout: SiteLayout): SiteConfig {
  const transform = (blocks: BlockConfig[]) => {
    const result = blocks.map(block => ({ ...block, variant: block.type === 'hero' ? layout.hero : block.type === 'navbar' ? layout.nav : block.type === 'articles' ? layout.articles : block.type === 'content' && layout.content ? layout.content : block.type === 'features' && layout.features ? layout.features : block.variant }))
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
