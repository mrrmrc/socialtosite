import { t } from '@/lib/i18n'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '../store/configStore'
import { useProjectsStore } from '../store/projectsStore'
import { useEditorStore } from '../store/editorStore'
import { completeGeneratedSite, configFromProfile, decode, refreshArticles, siteRequest, type SiteData } from '../lib/social-site'
import { validateSiteConfig } from '../lib/generate-site'
import type { SiteConfig } from '../blocks/types'

export function SiteWorkspace({ generate = false, destination = '/editor' }: { generate?: boolean; destination?: string }) {
  const navigate = useNavigate()
  const [data, setData] = useState<SiteData>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [instructions, setInstructions] = useState('')

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
      const result = await siteRequest('openpage-generate', { instructions })
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
  return <div className="h-full overflow-y-auto"><div className="max-w-2xl mx-auto p-8 space-y-5">
    <h1 className="text-2xl font-semibold">{generate ? 'Crea il sito dal tuo profilo' : 'Caricamento del tuo sito'}</h1>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p>{t("Recupero identità, menu e articoli…")}</p>}
    {error && <button disabled={busy} onClick={() => setRevision(r => r + 1)}>{t("Riprova")}</button>}
    {generate && data && <>
      <p>{t("La generazione usa identità, intervista, istruzioni editoriali, presenza, contatti, social e articoli. Potrai modificare ogni blocco prima di pubblicare.")}</p>
      <p className="text-text-2">{String(data.site.profile_summary || data.site.bio || '')}</p>
      <label className="block">{t("Preferenze grafiche facoltative")}<textarea value={instructions} onChange={e => setInstructions(e.target.value)} className="block w-full bg-bg-2 border rounded p-3 mt-2" /></label>
      <p className="text-text-2">{t("Your previous draft is kept in Projects. The online site changes only when you publish.")}</p>
      <button disabled={busy} onClick={createSite} className="bg-green text-black rounded px-5 py-3">{busy ? 'Creazione in corso…' : 'Genera una nuova proposta'}</button>
      <button disabled={busy} onClick={() => openSite(data)} className="ml-4">{t("Modifica il sito attuale")}</button>
    </>}
    <a className="block text-green" href="/dashboard?tab=profile">{t("Torna alla profilazione")}</a>
  </div></div>
}
