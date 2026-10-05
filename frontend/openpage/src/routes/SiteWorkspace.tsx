import { t } from '@/lib/i18n'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '../store/configStore'
import { useProjectsStore } from '../store/projectsStore'
import { useEditorStore } from '../store/editorStore'
import { completeGeneratedSite, configFromProfile, decode, refreshArticles, siteRequest, type SiteData } from '../lib/social-site'
import { validateSiteConfig } from '../lib/generate-site'
import type { SiteConfig } from '../blocks/types'
import { Sparkles, ArrowLeft, Pencil, UserRound, Loader2 } from 'lucide-react'
import { DesignBrief } from '../editor/DesignBrief'
import { parseDesignReferences } from '../lib/design-brief'
import { toast } from 'sonner'

export function SiteWorkspace({ generate = false, destination = '/editor' }: { generate?: boolean; destination?: string }) {
  const navigate = useNavigate()
  const [data, setData] = useState<SiteData>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [brief, setBrief] = useState({ description: '', references: '' })

  function openSite(d: SiteData, generated?: SiteConfig) {
    const id = `social-site-${d.user.id}`
    const store = useProjectsStore.getState()
    const draft = store.projects.find(p => p.id === id)
    const saved = decode(d.site.openpage_config)
    if (!generated && !draft?.config && d.site.openpage_config && !Array.isArray(saved.blocks) && !Array.isArray(saved.pages)) throw new Error('La configurazione salvata non è valida. Il sito pubblicato è stato conservato.')
    const config = refreshArticles(generated || draft?.config || (d.site.openpage_config ? validateSiteConfig(saved) : configFromProfile(d)), d)
    if (!draft) useProjectsStore.setState(s => ({ projects: [{ id, name: config.name, status: 'draft', updatedAt: 'Ora', blockCount: config.blocks.length }, ...s.projects] }))
    store.updateProjectConfig(id, config)
    if (!draft?.settings) store.updateProjectSettings(id, { language: 'Italian', siteName: config.name, seoDescription: String(d.site.hero_tagline || d.site.profile_summary || ''), ogImageUrl: String(d.site.cover_url || '') })
    useConfigStore.getState().setConfig(config)
    useEditorStore.getState().setActiveProject(id)
    navigate(destination, { replace: true })
  }

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    setData(undefined)
    siteRequest('site', undefined, controller.signal).then(d => {
      if (controller.signal.aborted) return
      setData(d)
      if (!generate) openSite(d)
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [generate, revision]) // eslint-disable-line react-hooks/exhaustive-deps

  async function createSite() {
    if (!data) return
    setBusy(true)
    setError('')
    try {
      const result = await siteRequest('openpage-generate', { instructions: brief.description, references: parseDesignReferences(brief.references) })
      if (result.references?.some((ref: { status: string }) => ref.status === 'unavailable')) toast.warning(t('Some references could not be read. Your description was used.'))
      const store = useProjectsStore.getState()
      const previous = store.projects.find(p => p.id === `social-site-${data.user.id}`)
      if (previous?.config) {
        const backupId = store.addProject(`${previous.name} · ${t('Previous draft')}`)
        store.updateProjectConfig(backupId, previous.config)
        if (previous.settings) store.updateProjectSettings(backupId, previous.settings)
      }
      openSite(data, completeGeneratedSite(validateSiteConfig(result.config), data))
    } catch (e) { setError(e instanceof Error ? e.message : 'Generazione non riuscita') }
    finally { setBusy(false) }
  }
  return <div className="h-full overflow-y-auto"><div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
    <h1 className="text-3xl font-semibold flex items-center gap-3"><Sparkles aria-hidden="true" />{generate ? t('Crea il sito dal tuo profilo') : t('Caricamento del tuo sito')}</h1>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p>{t("Recupero identità, menu e articoli…")}</p>}
    {error && <button disabled={busy} onClick={() => setRevision(r => r + 1)}>{t("Riprova")}</button>}
    {generate && data && <>
      <p>{t("La generazione usa identità, intervista, istruzioni editoriali, presenza, contatti, social e articoli. Potrai modificare ogni blocco prima di pubblicare.")}</p>
      <div className="bg-bg-1 border border-border-default rounded-xl p-4"><h2 className="flex gap-2 items-center font-semibold mb-2"><UserRound size={18} aria-hidden="true" />{t('Your profile')}</h2><p className="text-text-2">{String(data.site.profile_summary || data.site.bio || '')}</p></div>
      <DesignBrief value={brief} onChange={setBrief} disabled={busy} />
      <p className="text-text-2">{t("Your previous draft is kept in Projects. The online site changes only when you publish.")}</p>
      <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={createSite} className="bg-green text-black rounded-lg px-5 py-3 flex gap-2 items-center">{busy ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}{busy ? t('Creazione in corso…') : t('Genera una nuova proposta')}</button>
      <button disabled={busy} onClick={() => openSite(data)} className="border border-border-default rounded-lg px-5 py-3 flex items-center gap-2"><Pencil size={18} aria-hidden="true" />{t("Modifica il sito attuale")}</button></div>
    </>}
    <a className="flex items-center gap-2 text-green" href="/dashboard?tab=profile"><ArrowLeft size={18} aria-hidden="true" />{t("Torna alla profilazione")}</a>
  </div></div>
}
