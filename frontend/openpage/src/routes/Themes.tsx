import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Palette, Search, Check, ArrowLeft, Sparkles, Loader2, BookOpen, BriefcaseBusiness, HeartHandshake, Camera, LayoutGrid, Eye } from 'lucide-react'
import { useConfigStore } from '../store/configStore'
import { useProjectsStore } from '../store/projectsStore'
import { useEditorStore } from '../store/editorStore'
import { siteLayouts, applySiteLayout } from '../lib/site-layouts'
import { themePresets } from '../lib/theme-presets'
import { exportSiteToHTML } from '../lib/export-html'
import { DesignBrief } from '../editor/DesignBrief'
import { parseDesignReferences, applyGeneratedPresentation } from '../lib/design-brief'
import { siteRequest } from '../lib/social-site'
import { validateSiteConfig } from '../lib/generate-site'
import type { SiteConfig } from '../blocks/types'
import { t } from '../lib/i18n'

const categories = [{name:'All',icon:LayoutGrid},{name:'Personal',icon:BookOpen},{name:'Creative',icon:Camera},{name:'Editorial',icon:BookOpen},{name:'Business',icon:BriefcaseBusiness},{name:'Community',icon:HeartHandshake}]
const categoryOf = (id:string,category?:string) => category || ({author:'Personal',portfolio:'Creative',magazine:'Editorial',business:'Business',community:'Community'}[id] || 'Personal')
export function Themes() {
  const config = useConfigStore(s => s.config)
  const [selected, setSelected] = useState(siteLayouts[0])
  const [category,setCategory] = useState('All')
  const [search,setSearch] = useState('')
  const [brief,setBrief] = useState({description:'',references:''})
  const [custom,setCustom] = useState<SiteConfig>()
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [feedback,setFeedback] = useState<{url:string;status:string;message?:string}[]>([])
  const navigate = useNavigate()
  const proposal = useMemo(() => custom || applySiteLayout(config, selected), [config, selected, custom])
  const html = useMemo(() => exportSiteToHTML(proposal), [proposal])
  const layouts = siteLayouts.filter(layout => (category==='All' || categoryOf(layout.id,layout.category)===category) && (t(layout.name)+' '+t(layout.description)).toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  function apply() {
    useConfigStore.getState().applyPresentation(proposal)
    const id = useEditorStore.getState().activeProjectId
    if (id) useProjectsStore.getState().updateProjectConfig(id, proposal)
    navigate('/editor')
  }
  async function customize() {
    setError('');setFeedback([])
    try {
      const references=parseDesignReferences(brief.references)
      if (!brief.description.trim()) throw new Error(t('Describe the style you want before generating.'))
      setBusy(true)
      const result=await siteRequest('openpage-generate',{instructions:brief.description,references,mode:'layout',config})
      setCustom(applyGeneratedPresentation(config,validateSiteConfig(result.config)))
      setFeedback(result.references || [])
    } catch(e) {setError(e instanceof Error ? e.message : t('Generation failed'))}
    finally {setBusy(false)}
  }
  return <div className="h-full overflow-auto p-4 md:p-6"><div className="max-w-7xl mx-auto space-y-6">
    <header><h1 className="flex items-center gap-3 text-3xl font-semibold"><Palette aria-hidden="true" />{t('Themes and layouts')}</h1><p className="text-text-1 mt-3">{t('Preview each layout with your content. Text, menu, articles, contacts and custom sections are preserved. Changes stay in your draft until you publish.')}</p></header>
    <section className="grid gap-6 lg:grid-cols-2" aria-label={t('Choose and preview')}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">{categories.map(({name,icon:Icon})=><button key={name} aria-pressed={category===name} onClick={()=>setCategory(name)} className={'flex items-center gap-2 px-3 py-2 rounded-lg border '+(category===name?'border-green text-green bg-green-glow':'border-border-default bg-bg-1')}><Icon size={17} aria-hidden="true" />{t(name)}</button>)}</div>
        <label className="flex items-center gap-2 p-3 bg-bg-1 rounded-xl border border-border-default"><Search size={18} aria-hidden="true" /><input aria-label={t('Search layouts')} placeholder={t('Search layouts')} value={search} onChange={e=>setSearch(e.target.value)} className="w-full bg-transparent outline-none" /></label>
        <p className="text-sm text-text-2">{layouts.length} / {siteLayouts.length} {t('layouts')}</p>
        <div className="grid sm:grid-cols-2 gap-3 max-h-[560px] overflow-auto pr-1">{layouts.map(layout=>{const theme=themePresets.find(p=>p.id===layout.theme)!.theme;const Icon=categories.find(c=>c.name===categoryOf(layout.id,layout.category))!.icon;return <button key={layout.id} onClick={()=>{setSelected(layout);setCustom(undefined);setError('')}} aria-pressed={!custom && selected.id===layout.id} className={'rounded-xl border p-4 text-left '+(!custom && selected.id===layout.id?'border-green bg-bg-3':'border-border-default bg-bg-1')}>
          <div aria-hidden="true" className="rounded-lg p-3 mb-3 h-20 border flex gap-2" style={{background:theme.bg1,borderColor:theme.borderDefault}}><div className="flex-1"><div className="h-2 w-2/3 rounded mb-2" style={{background:theme.text0}} /><div className="h-1 rounded w-full mb-1" style={{background:theme.text2}} /><div className="h-1 rounded w-3/4" style={{background:theme.text2}} /><div className="h-3 w-8 rounded mt-2" style={{background:theme.accent}} /></div>{layout.hero==='split' && <div className="w-1/3 rounded" style={{background:theme.bg3}} />}</div>
          <strong className="flex gap-2 items-center text-lg"><Icon size={18} aria-hidden="true" />{t(layout.name)}</strong><span className="block mt-2 text-text-1">{t(layout.description)}</span>
        </button>})}</div>{!layouts.length && <p role="status">{t('No layouts match this search.')}</p>}
      </div>
      <div className="space-y-3"><h2 className="flex gap-2 items-center text-xl font-semibold"><Eye size={20} aria-hidden="true" />{custom?t('Custom proposal'):t(selected.name)}</h2><iframe title={t('Layout preview')} srcDoc={html} sandbox="allow-scripts" className="w-full h-[540px] rounded-xl border border-border-default bg-white" /><div className="flex flex-wrap gap-3"><button disabled={busy} onClick={apply} className="flex items-center gap-2 bg-green text-black rounded-lg px-5 py-3 font-semibold"><Check size={18} aria-hidden="true" />{t('Apply to draft')}</button><Link to="/editor" className="flex items-center gap-2 px-3 py-3"><ArrowLeft size={18} aria-hidden="true" />{t('Back to editor')}</Link></div><p className="text-sm text-text-2">{t('You can undo this change in the editor.')}</p></div>
    </section>
    <section className="rounded-xl border border-border-default bg-bg-2 p-5 space-y-4"><h2 className="flex items-center gap-2 text-xl font-semibold"><Sparkles size={22} aria-hidden="true" />{t('Design a custom layout')}</h2><p>{t('Describe your visual idea. We keep your existing content and create a proposal to preview before applying it.')}</p><DesignBrief value={brief} onChange={setBrief} disabled={busy} /><button disabled={busy} onClick={customize} className="bg-green text-black rounded-lg px-5 py-3 font-semibold flex items-center gap-2">{busy?<Loader2 className="animate-spin" size={18} aria-hidden="true" />:<Sparkles size={18} aria-hidden="true" />}{busy?t('Creating proposal…'):t('Preview custom proposal')}</button>{error && <p role="alert" className="text-status-red">{error}</p>}{feedback.length>0 && <ul className="text-sm space-y-2" aria-label={t('Reference results')}>{feedback.map((ref,index)=><li key={index}>{ref.url} — {ref.status==='read'?t('HTML reference read'):ref.message}</li>)}</ul>}{custom && <p role="status">{t('Custom preview ready. Review it above and apply it when you are satisfied.')}</p>}</section>
  </div></div>
}
