import { t } from '@/lib/i18n'
import { LayersPanel } from './LayersPanel'
import { ComponentCatalogue } from './ComponentCatalogue'

export function LeftSidebar() {
  return <aside className="editor-left-sidebar hidden md:flex bg-bg-1 border-r border-border-default flex-col shrink-0" aria-label="Sezioni e componenti">
    <section className="editor-sections" aria-label="Sezioni della pagina"><LayersPanel compact /></section>
    <section className="editor-catalogue flex flex-col flex-1 min-h-0" aria-labelledby="editor-components-title">
      <h2 id="editor-components-title" className="editor-panel-title">{t('Components')} <span>Aggiungi alla pagina</span></h2>
      <ComponentCatalogue />
    </section>
  </aside>
}
