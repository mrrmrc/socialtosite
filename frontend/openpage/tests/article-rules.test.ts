import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {filterArticles} from '../src/lib/article-rules'
import {refreshArticles,type SiteData} from '../src/lib/social-site'
import {exportSiteToHTML} from '../src/lib/export-html'
const fixture=JSON.parse(readFileSync(new URL('../../../tools/article_rules_cases.json',import.meta.url),'utf8'))
describe('Article display parity between editor and public renderer',()=>{
  it('matches the PHP fixtures for inclusive dates, rolling windows, order and limits',()=>{
    const items=fixture.posts.map((p:Record<string,unknown>)=>({...p,publishedAt:p.published_at||p.imported_at}))
    for(const sample of fixture.cases)expect(filterArticles(items,sample.rules,Date.parse(fixture.now)).map(p=>p.id)).toEqual(sample.ids)
  })
  it('retains rules when refreshing posts and leaves the full source untouched',()=>{
    const data:SiteData={user:{id:1,slug:'demo'},site:{},sources:[],posts:fixture.posts.map((p:object)=>({...p,published:1,generated_title:'Saved',slug:'saved'}))}
    const result=refreshArticles({name:'Demo',blocks:[{id:'posts',type:'articles',variant:'list',props:{maxArticles:2,dateFrom:'2026-10-03'}}]},data)
    expect(result.blocks[0].props.maxArticles).toBe(2)
    expect(result.blocks[0].props.dateFrom).toBe('2026-10-03')
    expect(result.blocks[0].props.items).toHaveLength(5)
    expect(data.posts).toHaveLength(5)
    const html=exportSiteToHTML(result)
    expect((html.match(/<article /g)||[]).length).toBe(2)
  })
})
