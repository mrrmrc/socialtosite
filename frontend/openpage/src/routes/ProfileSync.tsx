import {PresentationApproval} from '../editor/PresentationApproval'
import {useEffect,useMemo,useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {UserRound,Check,ArrowLeft} from 'lucide-react'
import {useConfigStore} from '../store/configStore'
import {useEditorStore} from '../store/editorStore'
import {useProjectsStore} from '../store/projectsStore'
import {siteRequest,type SiteData} from '../lib/social-site'
import {applyPublicProfile,type ProfileSections} from '../lib/profile-presentation'
import {exportSiteToHTML} from '../lib/export-html'
import {t} from '../lib/i18n'
export function ProfileSync(){
  const [approval,setApproval]=useState(false)
  const config=useConfigStore(s=>s.config)
  const [data,setData]=useState<SiteData>()
  const [error,setError]=useState('')
  const [sections,setSections]=useState<ProfileSections>({name:false,images:false,about:false,contacts:false})
  const navigate=useNavigate()
  useEffect(()=>{const controller=new AbortController();siteRequest('site',undefined,controller.signal).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()},[])
  const proposal=useMemo(()=>data?applyPublicProfile(config,data,sections):config,[config,data,sections])
  const html=useMemo(()=>exportSiteToHTML(proposal),[proposal])
  function apply(){if(!data)return;useConfigStore.getState().applyPresentation(proposal);const id=useEditorStore.getState().activeProjectId;if(id)useProjectsStore.getState().updateProjectConfig(id,proposal);navigate('/editor')}
  return <div className="h-full overflow-auto p-6"><div className="w-full min-w-0 space-y-5"><h1 className="text-3xl font-semibold flex items-center gap-3"><UserRound/>{t('Review profile changes')}</h1><p>{t('Choose which saved public information to transfer to the draft. Your layout, menu, article rules, other pages and custom sections are preserved. Review the preview before applying; publish from the editor when ready.')}</p>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p>{t('Loading…')}</p>}{data&&<div className="grid lg:grid-cols-[320px_1fr] gap-6"><section className="rounded-xl border border-border-default bg-bg-1 p-5 space-y-4"><h2 className="text-xl font-semibold">{t('Saved public information')}</h2><p>{String(data.site.title||'')}</p><p>{String(data.site.hero_tagline||'')}</p><p className="text-text-2 whitespace-pre-line">{String(data.site.profile_summary||data.site.bio||'')}</p>{([['name','Name and opening title'],['images','Logo and cover image'],['about','About section'],['contacts','Contact section']] as const).map(([key,label])=><label className="flex gap-3 items-center" key={key}><input type="checkbox" checked={sections[key]} onChange={e=>setSections(v=>({...v,[key]:e.target.checked}))}/>{t(label)}</label>)}<button disabled={!Object.values(sections).some(Boolean)} onClick={()=>setApproval(true)} className="flex gap-2 items-center bg-green rounded-lg px-4 py-3 font-semibold"><Check size={18}/>{t('Apply to draft')}</button><Link to="/editor" className="flex items-center gap-2"><ArrowLeft size={18}/>{t('Back to editor')}</Link><a href="/dashboard?tab=profile" className="block text-green">{t('Edit profile')}</a><p className="text-sm text-text-2">{t('You can undo this change in the editor.')}</p></section><iframe title={t('Layout preview')} srcDoc={html} sandbox="allow-scripts" className="w-full h-[640px] rounded-xl border border-border-default bg-white"/></div>}</div>{approval&&<PresentationApproval proposal={proposal} label={t("Review profile changes")} onApprove={apply} onClose={()=>setApproval(false)}/>}</div>
}
