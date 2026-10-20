import { describe, expect, it } from 'vitest'
import { applySiteLayout, siteLayouts } from '../src/lib/site-layouts'
import { homeFirst } from '../src/lib/social-site'
import { useConfigStore } from '../src/store/configStore'
import type { SiteConfig } from '../src/blocks/types'

const config: SiteConfig = { name: 'My content', blocks: [
  { id: 'nav', type: 'navbar', variant: 'default', props: { links: ['About', 'Home', 'Work'], linkUrls: ['#about', '/', '#work'] } },
  { id: 'hero', type: 'hero', variant: 'split', props: { headline: 'Custom title', heroImage: '/photo.jpg' } },
  { id: 'custom', type: 'content', variant: 'default', props: { body: 'My edits' } },
  { id: 'posts', type: 'articles', variant: 'grid', props: { items: [{ title: 'Published article' }] } },
] }
describe('Layouts preserve customer data', () => {
  it('keeps every property, block and page in all layouts without mutating the source', () => {
    const original = JSON.stringify(config)
    const pages = [{ id: 'home', path: '/', name: 'Home', blocks: config.blocks }, { id: 'extra', path: '/extra', name: 'Extra', blocks: config.blocks }]
    for (const layout of siteLayouts) {
      const result = applySiteLayout({ ...config, pages }, layout)
      expect(result.pages?.map(p => p.id)).toEqual(['home', 'extra'])
      for (const block of config.blocks) expect(result.blocks.find(b => b.id === block.id)?.props).toEqual(block.props)
      expect(result.blocks).toHaveLength(config.blocks.length)
    }
    expect(JSON.stringify(config)).toBe(original)
  })
  it('undoes a layout as one operation, restoring content and theme', () => {
    useConfigStore.getState().setConfig(config)
    const before = useConfigStore.getState().config
    useConfigStore.getState().applyPresentation(applySiteLayout(before, siteLayouts[2]))
    expect(useConfigStore.getState().config.blocks[2].id).toBe('posts')
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config).toEqual(before)
  })
  it('moves Home first with its correct destination and retains other links', () => {
    const block = homeFirst(config.blocks[0], '/marco')
    expect(block.props.links).toEqual(['Home', 'About', 'Work'])
    expect(block.props.linkUrls).toEqual(['/marco', '#about', '#work'])
    expect(homeFirst(block, '/marco')).toEqual(block)
  })
})
