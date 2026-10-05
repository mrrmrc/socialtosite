import type { BlockConfig, SiteConfig } from '../blocks/types'
import { configFromProfile, type SiteData } from './social-site'
export type ProfileSections = { name: boolean; images: boolean; about: boolean; contacts: boolean }
export function applyPublicProfile(config:SiteConfig,data:SiteData,sections:ProfileSections):SiteConfig {
  const seed=configFromProfile(data)
  const navbar=seed.blocks.find(b=>b.type==='navbar')!,hero=seed.blocks.find(b=>b.type==='hero')!
  const about=seed.blocks.find(b=>b.id==='sts-about')!,contacts=seed.blocks.find(b=>b.id==='sts-contact')!
  const transform=(blocks:BlockConfig[])=>{
    const result=blocks.map(block=>{
      const props={...block.props}
      if(block.type==='navbar') {if(sections.name)props.logo=navbar.props.logo;if(sections.images)props.logoImage=navbar.props.logoImage}
      if(block.type==='hero') {if(sections.name) {props.headline=hero.props.headline;props.subheadline=hero.props.subheadline} if(sections.images)props.heroImage=hero.props.heroImage}
      if(block.id==='sts-about' && block.type==='content' && sections.about)props.body=about.props.body
      if(block.id==='sts-contact' && block.type==='content' && sections.contacts)props.body=contacts.props.body
      return {...block,props}
    })
    for(const [enabled,block] of [[sections.about,about],[sections.contacts,contacts]] as const) {
      if(enabled && !result.some(b=>b.id===block.id)) {const index=result.findIndex(b=>b.type===(block.id==='sts-about'?'articles':'footer'));result.splice(index<0?result.length:index,0,block)}
    }
    return result
  }
  const pages=config.pages?.map(page=>page.path==='/'?{...page,blocks:transform(page.blocks)}:page)
  return {...config,name:sections.name?seed.name:config.name,blocks:pages?.find(p=>p.path==='/')?.blocks||transform(config.blocks),pages}
}
