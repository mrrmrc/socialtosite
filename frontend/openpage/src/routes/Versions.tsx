import {useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useConfigStore} from '../store/configStore'
import {useEditorStore} from '../store/editorStore'
import {useProjectsStore} from '../store/projectsStore'
import {siteRequest} from '../lib/social-site'
import {saveSiteVersion,type SiteVersion} from '../lib/site-versions'
import {PresentationApproval} from '../editor/PresentationApproval'
import {t,getBrowserLanguage} from '../lib/i18n'
export function Versions(){
 const config=useConfigStore(s=>s.config),navigate=useNavigate()
 const [versions,setVersions]=useState<SiteVersion[]>([]),[label,setLabel]=useState(''),[selected,setSelected]=useState<SiteVersion>(),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function load(){try{setVersions((await siteRequest('openpage-versions')).versions)}catch(e){setError(e instanceof Error?e.message:String(e))}}
 useEffect(()=>{void load()},[])
 async function save(){setBusy(true);setError('');try{await saveSiteVersion(config,label);setLabel('');await load()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 function restore(){if(!selected)return;useConfigStore.getState().applyPresentation(selected.config);const id=useEditorStore.getState().activeProjectId;if(id){useProjectsStore.getState().updateProjectConfig(id,selected.config);if(selected.settings)useProjectsStore.getState().updateProjectSettings(id,selected.settings)}navigate('/editor')}
 return <div className="h-full overflow-auto p-6"><div className="max-w-5xl mx-auto space-y-5"><h1 className="text-3xl font-semibold">{t('Saved versions')}</h1><p>{t('Versions are saved in your account. Preview an earlier version and authorize its restoration to the draft. The public site changes only after publishing.')}</p><div className="flex flex-wrap gap-3"><label>{t('Version name')}<input value={label} onChange={e=>setLabel(e.target.value)} className="block border rounded-lg p-3 bg-bg-1" /></label><button disabled={busy} onClick={save} className="bg-green rounded-lg px-4 py-3 self-end">{busy?t('Saving…'):t('Save current version')}</button></div>{error&&<p role="alert">{error}</p>}{!versions.length&&<p>{t('No saved versions yet.')}</p>}{[...versions].reverse().map(v=><article key={v.id} className="border rounded-xl p-4 bg-bg-1 flex flex-wrap gap-3 justify-between"><div><strong>{v.label}</strong><p>{new Date(v.createdAt).toLocaleString(getBrowserLanguage())}</p></div><div className="flex gap-3"><button onClick={()=>setSelected(v)}>{t('Preview and restore')}</button><button onClick={()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(v)],{type:'application/json'}));a.download='site-version-'+v.id+'.json';a.click();URL.revokeObjectURL(a.href)}}>{t('Download JSON')}</button></div></article>)}</div>{selected&&<PresentationApproval proposal={selected.config} label={t('Restore version')+' · '+selected.label} onApprove={restore} onClose={()=>setSelected(undefined)}/>}</div>
}
