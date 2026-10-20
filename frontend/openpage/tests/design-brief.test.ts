import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseDesignReferences, applyGeneratedPresentation } from '../src/lib/design-brief'
import { googleFontUrl } from '../src/lib/site-fonts'
import { validateSiteConfig } from '../src/lib/generate-site'
import { siteLayouts, applySiteLayout } from '../src/lib/site-layouts'
import type { SiteConfig } from '../src/blocks/types'

const original: SiteConfig = { name: 'Customer', blocks: [{ id: 'articles', type: 'articles', variant: 'grid', props: { title: 'Actual articles', items: [{title:'Saved'}] } }, {id:'custom',type:'content',variant:'default',props:{body:'Saved contact [Email](mailto:me@example.com)'}}], pages:[{id:'extra',name:'Extra',path:'/extra',blocks:[{id:'extra-content',type:'content',variant:'default',props:{body:'Saved extra page'}}]}] }
describe('Design changes preserve functionality', () => {
  it('validates references and rejects protocols, credentials and excess links', () => {
    expect(parseDesignReferences('https://example.com\nhttps://example.com\n')).toEqual(['https://example.com/'])
    for (const value of ['javascript:alert(1)', 'https://user:password@example.com', 'not a link', 'https://a.com\nhttps://b.com\nhttps://c.com\nhttps://d.com']) expect(()=>parseDesignReferences(value)).toThrow()
  })
  it('applies only allowed presentation while preserving content, identities, pages and order', () => {
    const generated: SiteConfig = {name:'Replaced',theme:{fontSans:'Georgia'},blocks:[{...original.blocks[0],variant:'list',props:{title:'Invented'}},{...original.blocks[1],variant:'unrecognized',props:{body:'Removed'}}],pages:[{...original.pages![0],blocks:[{...original.pages![0].blocks[0],variant:'columns',props:{body:'Invented'}}]}]}
    const result=applyGeneratedPresentation(original,generated)
    expect(result.name).toBe(original.name)
    expect(result.blocks.map(b=>b.props)).toEqual(original.blocks.map(b=>b.props))
    expect(result.blocks.map(b=>b.variant)).toEqual(['list','default'])
    expect(result.pages![0].blocks[0].props).toEqual(original.pages![0].blocks[0].props)
    expect(result.pages![0].blocks[0].variant).toBe('columns')
    expect(original.blocks[0].variant).toBe('grid')
  })
  it('retains every gallery variant when the saved draft is reloaded', () => {
    expect(siteLayouts).toHaveLength(25)
    for (const layout of siteLayouts) {
      const styled=applySiteLayout(original,layout)
      const loaded=validateSiteConfig(JSON.parse(JSON.stringify(styled)))
      expect(loaded.blocks.map(b=>b.variant)).toEqual(styled.blocks.map(b=>b.variant))
    }
  })
  it('uses identical font weights and typography in preview and published pages', () => {
    expect(googleFontUrl(['Space Grotesk','Inter','Inter'])).toBe(googleFontUrl(['Inter','Space Grotesk']))
    expect(googleFontUrl(['Space Grotesk'])).toContain('Space+Grotesk:wght@300;400;500;600;700')
    const shared=readFileSync(new URL('../src/lib/site-typography.css',import.meta.url),'utf8')
    const deployed=readFileSync(new URL('../../../public/openpage-typography.css',import.meta.url),'utf8')
    expect(shared.replace(/\r\n/g,'\n')).toBe(deployed.replace(/\r\n/g,'\n'))
  })
})
