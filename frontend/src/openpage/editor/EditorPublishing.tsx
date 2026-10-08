import { useState } from 'react'
import { Globe, Download, FileJson, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { useProjectsStore } from '@/store/projectsStore'
import { exportToHTML, downloadHTML } from '@/lib/export-html'
import { publishSite } from '@/lib/publish-site'

export function EditorPublishing() {
  const config = useConfigStore(s => s.config)
  const activeProjectId = useEditorStore(s => s.activeProjectId)
  const previewMode = useEditorStore(s => s.previewMode)
  const project = useProjectsStore(s => s.projects.find(item => item.id === activeProjectId))
  const setDeployInfo = useProjectsStore(s => s.setDeployInfo)
  const [busy, setBusy] = useState<'publish' | 'html' | null>(null)
  const buttonClass = 'flex items-center gap-1.5 rounded border border-border-default px-2 py-1 text-xs hover:border-green disabled:opacity-40'

  async function publish() {
    if (!activeProjectId || busy) return
    setBusy('publish')
    try {
      const result = await publishSite({ config, projectName: project?.name || config.name, settings: project?.settings })
      setDeployInfo(activeProjectId, result.liveUrl, result.deploymentId)
      toast.success('Sito pubblicato')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Pubblicazione non riuscita') }
    finally { setBusy(null) }
  }

  async function download() {
    if (busy) return
    setBusy('html')
    try {
      const html = await exportToHTML(config, { settings: project?.settings })
      downloadHTML(html, `${(project?.name || config.name || 'site').toLowerCase().replace(/\s+/g, '-')}.html`)
    } catch { toast.error('Esportazione non riuscita') }
    finally { setBusy(null) }
  }

  function downloadJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'site-config.json'; anchor.click()
    URL.revokeObjectURL(url)
  }

  return <div aria-label="Anteprima e pubblicazione del sito" className="flex shrink-0 items-center flex-wrap gap-2 border-b border-border-default bg-bg-2 px-3 py-1.5 text-xs">
    <span className="text-text-2">{previewMode ? 'Anteprima della bozza · naviga tra le pagine' : 'Bozza modificabile'}</span>
    <span className="text-text-3">Il sito online cambia solo con Pubblica.</span>
    {project?.deployUrl && <>
      <a href={project.deployUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green" title={project.deployUrl}><Globe size={13} />Apri sito online</a>
      <button type="button" aria-label="Copia indirizzo del sito" className={buttonClass} onClick={() => navigator.clipboard?.writeText(project.deployUrl!).then(() => toast('Indirizzo copiato')).catch(() => toast.error('Copia non disponibile'))}><Copy size={12} /></button>
    </>}
    {project?.lastDeployedAt && <span className="text-text-3" title={project.lastDeployedAt}>Ultima pubblicazione: {new Date(project.lastDeployedAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' })}</span>}
    <div className="ml-auto flex items-center gap-1.5">
      <button type="button" className={buttonClass} onClick={downloadJson}><FileJson size={13} />Scarica JSON</button>
      <button type="button" className={buttonClass} disabled={Boolean(busy)} onClick={download}>{busy === 'html' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}Scarica HTML</button>
      <button type="button" className="flex items-center gap-1.5 rounded bg-green text-bg-0 px-3 py-1 text-xs font-semibold disabled:opacity-40" disabled={!activeProjectId || Boolean(busy)} onClick={publish}>{busy === 'publish' ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}{busy === 'publish' ? 'Pubblicazione…' : 'Pubblica'}</button>
    </div>
  </div>
}
