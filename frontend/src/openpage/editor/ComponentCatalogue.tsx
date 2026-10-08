import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
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

export function ComponentCatalogue() {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'components' | 'variants'>('variants')
  const addBlock = useConfigStore(s => s.addBlock)
  const selectBlock = useEditorStore(s => s.selectBlock)
  const totalVariants = blockMetadata.reduce((sum, meta) => sum + meta.variants.length, 0)
  const entries = blockMetadata.flatMap(meta => (view === 'variants' ? meta.variants : [meta.variants[0]]).map(variant => ({ meta, variant })))
    .filter(({ meta, variant }) => [t(meta.label), t(meta.category), variant, variantNames[variant]].join(' ').toLowerCase().includes(search.toLowerCase()))

  return <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
    <div className="px-2 py-2 shrink-0">
      <div className="flex gap-1 mb-2" role="group" aria-label="Vista del catalogo">
        {(['components', 'variants'] as const).map(mode => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className="flex-1 rounded border px-1 py-1.5 text-xs" style={{ borderColor: view === mode ? 'var(--color-green)' : 'var(--color-border-default)', background: view === mode ? 'var(--color-green-glow)' : 'var(--color-bg-2)', color: view === mode ? 'var(--color-green)' : 'var(--color-text-1)' }}>{mode === 'components' ? `Componenti (${blockMetadata.length})` : `Varianti (${totalVariants})`}</button>)}
      </div>
      <label className="flex items-center gap-1.5 border border-border-default rounded px-2 py-1.5 bg-bg-2"><Search size={13} aria-hidden="true" /><input aria-label="Cerca componenti e varianti" placeholder="Cerca componenti e varianti…" value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-transparent text-xs outline-none" /></label>
      <p className="text-text-2 mt-2" style={{ fontSize: 11, lineHeight: 1.4 }}>{view === 'variants' ? 'Ogni scheda aggiunge la variante indicata.' : 'Ogni scheda aggiunge la variante standard.'} Contatti e Newsletter includono la privacy.</p>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 5, alignContent: 'start' }}>
      {entries.map(({ meta, variant }) => <button key={`${meta.type}-${variant}`} type="button" aria-label={`Aggiungi ${t(meta.label)} · ${variantNames[variant] || variant}`} title={`${t(meta.description)} · ${variant}`} onClick={() => {
        const id = `block-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
        addBlock({ id, type: meta.type, variant, props: structuredClone(meta.defaultProps) })
        selectBlock(id)
        toast(`${t(meta.label)} · ${variantNames[variant] || variant} aggiunto`)
      }} className="rounded border border-border-default bg-bg-1 hover:border-green hover:bg-green-glow2 text-left" style={{ padding: '7px 8px', minHeight: 56 }}>
        <span className="flex items-center justify-between gap-1 text-text-0" style={{ fontSize: 12, lineHeight: 1.25 }}><span>{t(meta.type === 'cta' ? 'CTA' : meta.label)}</span><Plus size={12} className="text-green shrink-0" aria-hidden="true" /></span>
        <span className="block mt-1 text-green" style={{ fontSize: 11 }}>{view === 'variants' ? variantNames[variant] || variant : `${meta.variants.length} ${meta.variants.length === 1 ? 'variante' : 'varianti'}`}</span>
      </button>)}
      {entries.length === 0 && <p className="text-text-2 text-xs" style={{ gridColumn: '1 / -1' }}>Nessun componente o variante corrisponde alla ricerca.</p>}
    </div>
  </div>
}
