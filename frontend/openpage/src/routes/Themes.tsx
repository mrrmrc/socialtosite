import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useConfigStore } from '../store/configStore'
import { useProjectsStore } from '../store/projectsStore'
import { useEditorStore } from '../store/editorStore'
import { siteLayouts, applySiteLayout } from '../lib/site-layouts'
import { exportSiteToHTML } from '../lib/export-html'
import { t } from '../lib/i18n'

export function Themes() {
  const config = useConfigStore(s => s.config)
  const [selected, setSelected] = useState<typeof siteLayouts[number]>(siteLayouts[0])
  const navigate = useNavigate()
  const proposal = useMemo(() => applySiteLayout(config, selected), [config, selected])
  const html = useMemo(() => exportSiteToHTML(proposal), [proposal])
  function apply() {
    useConfigStore.getState().applyPresentation(proposal)
    const id = useEditorStore.getState().activeProjectId
    if (id) useProjectsStore.getState().updateProjectConfig(id, proposal)
    navigate('/editor')
  }
  return <div className="h-full overflow-auto p-6">
    <div className="max-w-6xl mx-auto space-y-5">
      <h1 className="text-3xl font-semibold">{t('Themes and layouts')}</h1>
      <p className="text-text-1">{t('Preview each layout with your content. Text, menu, articles, contacts and custom sections are preserved. Changes stay in your draft until you publish.')}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{siteLayouts.map(layout => <button key={layout.id} onClick={() => setSelected(layout)} aria-pressed={selected.id === layout.id} className={`rounded-xl border p-4 text-left ${selected.id === layout.id ? 'border-green bg-bg-3' : 'border-border-default bg-bg-2'}`}>
        <strong className="block text-lg">{t(layout.name)}</strong><span className="block mt-2 text-text-1">{t(layout.description)}</span>
      </button>)}</div>
      <div className="flex flex-wrap gap-4 items-center"><button onClick={apply} className="bg-green text-black rounded-lg px-6 py-3 font-semibold">{t('Apply to draft')}</button><Link to="/editor" className="text-text-1 underline">{t('Back to editor')}</Link><span className="text-text-1">{t('You can undo this change in the editor.')}</span></div>
      <iframe title={t('Layout preview')} srcDoc={html} sandbox="allow-scripts" className="w-full h-[650px] rounded-xl border border-border-default bg-white" />
    </div>
  </div>
}
