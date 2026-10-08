import { useState } from 'react'
import { Plus, Search, Layout, Type, Grid3X3, DollarSign, Megaphone, PanelBottom, MessageSquare, BarChart3, HelpCircle, Users, Mail, Newspaper, Image, Minus, Flag, FileText, Play, GalleryHorizontalEnd, Layers, ShieldCheck, MousePointerClick } from 'lucide-react'
import { toast } from 'sonner'
import { blockMetadata } from '@/lib/block-metadata'
import { t } from '@/lib/i18n'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'

const variantNames: Record<string, string> = {
  default: 'Standard', centered: 'Centrata', split: 'Divisa', gradient: 'Sfumatura', minimal: 'Essenziale',
  grid: 'Griglia', list: 'Elenco', alternating: 'Alternata', simple: 'Semplice', comparison: 'Confronto',
  'multi-column': 'Più colonne', cards: 'Schede', carousel: 'Carosello', spotlight: 'In evidenza',
  bar: 'Barra', counter: 'Contatori', accordion: 'Fisarmonica', form: 'Modulo con privacy',
  prose: 'Testo', columns: 'Colonne', highlight: 'In evidenza', 'hero-image': 'Immagine grande',
  'side-by-side': 'Affiancata', youtube: 'YouTube', vimeo: 'Vimeo', masonry: 'Mosaico',
  line: 'Linea', space: 'Spazio', dots: 'Puntini', ribbon: 'Nastro',
}

const componentIcons: Record<string, typeof Layout> = {
  navbar: Layout, hero: Type, features: Grid3X3, pricing: DollarSign, cta: MousePointerClick,
  footer: PanelBottom, testimonials: MessageSquare, stats: BarChart3, faq: HelpCircle,
  team: Users, contact: Mail, newsletter: Newspaper, logocloud: ShieldCheck,
  divider: Minus, banner: Flag, content: FileText, image: Image, video: Play,
  gallery: GalleryHorizontalEnd, articles: Newspaper,
}
const families = [
  { id: 'structure', label: 'Struttura e navigazione', icon: Layers, types: ['navbar', 'hero', 'footer', 'divider'] },
  { id: 'content', label: 'Contenuti', icon: FileText, types: ['content', 'articles', 'features', 'faq', 'banner'] },
  { id: 'media', label: 'Immagini e video', icon: Image, types: ['image', 'video', 'gallery'] },
  { id: 'trust', label: 'Persone e fiducia', icon: ShieldCheck, types: ['team', 'testimonials', 'stats', 'logocloud'] },
  { id: 'forms', label: 'Contatti e iscrizioni', icon: Mail, types: ['contact', 'newsletter'] },
  { id: 'offers', label: 'Offerte e azioni', icon: Megaphone, types: ['pricing', 'cta'] },
]
const labelFor = (type: string, label: string) => t(type === 'articles' ? 'Articles' : type === 'cta' ? 'CTA' : label)

export function ComponentCatalogue() {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'components' | 'variants'>('variants')
  const [family, setFamily] = useState('all')
  const addBlock = useConfigStore(s => s.addBlock)
  const selectBlock = useEditorStore(s => s.selectBlock)
  const totalVariants = blockMetadata.reduce((sum, meta) => sum + meta.variants.length, 0)
  const entries = blockMetadata.flatMap(meta => (view === 'variants' ? meta.variants : [meta.variants[0]]).map(variant => ({ meta, variant })))
    .filter(({ meta, variant }) => [labelFor(meta.type, meta.label), t(meta.category), variant, variantNames[variant], families.find(item => item.types.includes(meta.type))?.label].join(' ').toLowerCase().includes(search.toLowerCase()))
  const groups = families.filter(item => family === 'all' || item.id === family)
    .map(item => ({ ...item, entries: entries.filter(entry => item.types.includes(entry.meta.type)) }))
    .filter(item => item.entries.length > 0)

  return <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
    <div className="px-2 py-2 shrink-0">
      <div className="flex gap-1 mb-2" role="group" aria-label="Vista del catalogo">
        {(['components', 'variants'] as const).map(mode => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className="flex-1 rounded border px-1 py-1.5 text-xs" style={{ borderColor: view === mode ? 'var(--color-green)' : 'var(--color-border-default)', background: view === mode ? 'var(--color-green-glow)' : 'var(--color-bg-2)', color: view === mode ? 'var(--color-green)' : 'var(--color-text-1)' }}>{mode === 'components' ? `Componenti (${blockMetadata.length})` : `Varianti (${totalVariants})`}</button>)}
      </div>
      <label className="flex items-center gap-1.5 border border-border-default rounded px-2 py-1.5 bg-bg-2"><Search size={13} aria-hidden="true" /><input aria-label="Cerca componenti e varianti" placeholder="Cerca componenti e varianti…" value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-transparent text-xs outline-none" /></label>
      <select aria-label="Filtra per famiglia" value={family} onChange={e => setFamily(e.target.value)} className="w-full mt-2 rounded border border-border-default bg-bg-2 text-text-0 px-2 py-1.5 text-xs"><option value="all">Tutte le famiglie</option>{families.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <p className="text-text-2 mt-2" style={{ fontSize: 11, lineHeight: 1.4 }}>{view === 'variants' ? 'Ogni scheda aggiunge la variante indicata.' : 'Ogni scheda aggiunge la variante standard.'} Contatti e Newsletter includono la privacy.</p>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
      {groups.map(group => <section key={group.id} aria-label={group.label} className="mb-3">
      <h3 className="flex items-center gap-1.5 text-text-1 py-2" style={{ fontSize: 11, fontWeight: 600 }}><group.icon size={14} className="text-green" aria-hidden="true" />{group.label}<span className="ml-auto text-text-3">{group.entries.length}</span></h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 5 }}>
      {group.entries.map(({ meta, variant }) => {
      const Icon = componentIcons[meta.type] || Layout
      return <button key={`${meta.type}-${variant}`} type="button" aria-label={`Aggiungi ${labelFor(meta.type, meta.label)} · ${variantNames[variant] || variant}`} title={`${t(meta.description)} · ${variant}`} onClick={() => {
        const id = `block-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
        addBlock({ id, type: meta.type, variant, props: structuredClone(meta.defaultProps) })
        selectBlock(id)
        toast(`${labelFor(meta.type, meta.label)} · ${variantNames[variant] || variant} aggiunto`)
      }} className="flex items-center gap-1.5 rounded border border-border-default bg-bg-1 hover:border-green hover:bg-green-glow2 text-left" style={{ padding: '5px 6px', minHeight: 42 }}>
        <Icon size={16} strokeWidth={1.7} className="text-green shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0"><span className="block text-text-0" style={{ fontSize: 11, lineHeight: 1.2 }}>{labelFor(meta.type, meta.label)}</span>
        <span className="block text-text-2" style={{ fontSize: 10, lineHeight: 1.2 }}>{view === 'variants' ? variantNames[variant] || variant : `${meta.variants.length} ${meta.variants.length === 1 ? 'variante' : 'varianti'}`}</span></span>
        <Plus size={10} className="text-green shrink-0" aria-hidden="true" />
      </button>})}
      </div></section>)}
      {groups.length === 0 && <p className="text-text-2 text-xs">Nessun componente o variante corrisponde alla ricerca.</p>}
    </div>
  </div>
}
