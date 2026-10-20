import {siteRequest} from './social-site'
import type {SiteConfig} from '../blocks/types'
import {useProjectsStore,type ProjectSettings} from '../store/projectsStore'
import {useEditorStore} from '../store/editorStore'
export interface SiteVersion {id:string;label:string;createdAt:string;config:SiteConfig;settings?:ProjectSettings}
export async function saveSiteVersion(config:SiteConfig,label:string) {
  const id=useEditorStore.getState().activeProjectId
  const settings=useProjectsStore.getState().projects.find(p=>p.id===id)?.settings
  return siteRequest('openpage-version',{config,label,settings})
}
export async function authorizePresentation(config:SiteConfig,label:string,apply:()=>void) {
  await saveSiteVersion(config,label)
  apply()
}
