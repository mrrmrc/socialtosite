import {expect,it} from 'vitest'
import {applyPublicProfile} from '../src/lib/profile-presentation'
import {configFromProfile,type SiteData} from '../src/lib/social-site'

const old:SiteData={user:{id:7,slug:'marco'},site:{title:'Old',bio:'Old biography'},posts:[],sources:[]}
const updated:SiteData={...old,site:{title:'Approved name',bio:'Approved biography',hero_tagline:'Approved introduction'}}
it('transfers selected public copy without changing layout, navigation, article rules or other pages',()=>{
  const config=configFromProfile(old)
  const hero=config.blocks.find(b=>b.type==='hero')!
  hero.variant='centered';hero.props.primaryCta='Personal action'
  const articles=config.blocks.find(b=>b.type==='articles')!
  articles.props.lastDays=30;articles.props.maxItems=4
  config.pages!.push({id:'extra',name:'Extra',path:'/extra',blocks:[{...hero,id:'extra-hero'}]})
  const before=structuredClone(config)
  const result=applyPublicProfile(config,updated,{name:true,images:false,about:true,contacts:false})
  expect(result.blocks.find(b=>b.type==='hero')).toEqual(expect.objectContaining({variant:'centered',props:expect.objectContaining({headline:'Approved name',primaryCta:'Personal action'})}))
  expect(result.blocks.find(b=>b.type==='navbar')?.props.links).toEqual(before.blocks.find(b=>b.type==='navbar')?.props.links)
  expect(result.blocks.find(b=>b.type==='articles')).toEqual(articles)
  expect(result.pages![1]).toEqual(before.pages![1])
  expect(result.blocks.find(b=>b.id==='sts-about')?.props.body).toContain('Approved biography')
  expect(config).toEqual(before)
})
it('leaves unchecked information unchanged',()=>{
  const config=configFromProfile(old)
  expect(applyPublicProfile(config,updated,{name:false,images:false,about:false,contacts:false})).toEqual(config)
})
it('adds an explicitly selected missing public section while retaining custom sections',()=>{
  const config=configFromProfile(old)
  config.blocks=config.blocks.filter(b=>b.id!=='sts-about')
  config.pages=undefined
  const result=applyPublicProfile(config,updated,{name:false,images:false,about:true,contacts:false})
  expect(result.blocks.filter(b=>b.id==='sts-about')).toHaveLength(1)
  expect(result.blocks.filter(b=>b.id!=='sts-about')).toEqual(config.blocks)
})
