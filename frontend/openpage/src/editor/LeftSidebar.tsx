import { t } from '@/lib/i18n'
import { useState } from 'react'
import { toast } from 'sonner'
import { Search, Layout, Type, Grid3X3, DollarSign, Megaphone, PanelBottom, MessageSquare, BarChart3, HelpCircle, Users, Mail, Newspaper, Image, Plus, Minus, Flag, FileText, ImageIcon, Play, GalleryHorizontalEnd } from 'lucide-react'
import { LayersPanel } from './LayersPanel'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { blockMetadata } from '@/lib/block-metadata'
import type { BlockType, BlockConfig } from '@/blocks/types'

const blockIcons: Record<BlockType, typeof Layout> = {
  navbar: Layout, hero: Type, features: Grid3X3, pricing: DollarSign,
  cta: Megaphone, footer: PanelBottom, testimonials: MessageSquare,
  stats: BarChart3, faq: HelpCircle, team: Users, contact: Mail,
  newsletter: Newspaper, logocloud: Image, divider: Minus, banner: Flag,
  content: FileText, image: ImageIcon, video: Play, gallery: GalleryHorizontalEnd, articles: Newspaper,
}

function ComponentsPanel() {
  const [search, setSearch] = useState('')
  const addBlock = useConfigStore((s) => s.addBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const filtered = blockMetadata.filter((b) =>
    t(b.label).toLowerCase().includes(search.toLowerCase()) ||
    t(b.category).toLowerCase().includes(search.toLowerCase())
  )

  function handleAdd(type: BlockType) {
    const meta = blockMetadata.find((b) => b.type === type)
    if (!meta) return
    const block: BlockConfig = {
      id: `block-${Date.now()}`,
      type,
      variant: meta.variants[0],
      props: { ...meta.defaultProps },
    }
    addBlock(block)
    selectBlock(block.id)
    toast(`${t(meta.label)} added`)
  }

  return (
    <div className="editor-components flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-3" />
          <input
            type="text"
            aria-label={t("Search components...")}
            placeholder={t("Search components...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-2 py-1.5 rounded-md border border-border-default bg-bg-2 text-text-0 text-[15px] outline-none focus:border-green placeholder:text-text-3"
            style={{ paddingLeft: '1.625rem' }}
          />
        </div>
      </div>

      <div className="editor-component-grid flex-1 overflow-y-auto px-2 pb-2">
        {filtered.map((meta) => {
          const Icon = blockIcons[meta.type] || Layout
          return <button key={meta.type} type="button" onClick={() => handleAdd(meta.type)} className="editor-component-tile" title={t(meta.description)}>
            <Icon size={16} aria-hidden="true" />
            <span>{t(meta.type === 'articles' ? 'Articles' : meta.type === 'cta' ? 'CTA' : meta.label)}</span>
            <Plus size={12} aria-hidden="true" />
          </button>
        })}
        {filtered.length === 0 && (
          <div className="px-2 py-6 text-center text-[15px] text-text-3">
            {t("No components match \"")}{search}{"\""}
          </div>
        )}
      </div>
    </div>
  )
}

export function LeftSidebar() {
  return <aside className="editor-left-sidebar hidden md:flex bg-bg-1 border-r border-border-default flex-col shrink-0" aria-label="Sezioni e componenti">
    <section className="editor-sections" aria-label="Sezioni della pagina"><LayersPanel compact /></section>
    <section className="editor-catalogue flex flex-col flex-1 min-h-0" aria-labelledby="editor-components-title">
      <h2 id="editor-components-title" className="editor-panel-title">{t('Components')} <span>Aggiungi alla pagina</span></h2>
      <ComponentsPanel />
    </section>
  </aside>
}
