import { useState } from 'react'
import { LayersPanel } from './LayersPanel'
import { ComponentCatalogue } from './ComponentCatalogue'

type Tab = 'layers' | 'components'

export function LeftSidebar() {
  const [tab, setTab] = useState<Tab>('layers')

  return (
    <div className="hidden md:flex w-[280px] bg-bg-1 border-r border-border-default flex-col shrink-0">
      <div className="flex border-b border-border-default shrink-0">
        <button
          onClick={() => setTab('layers')}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
            tab === 'layers'
              ? 'text-text-0 border-b border-green'
              : 'text-text-3 hover:text-text-1'
          }`}
        >
          Layers
        </button>
        <button
          onClick={() => setTab('components')}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
            tab === 'components'
              ? 'text-text-0 border-b border-green'
              : 'text-text-3 hover:text-text-1'
          }`}
        >
          Components
        </button>
      </div>
      {tab === 'layers' ? <LayersPanel /> : <ComponentCatalogue />}
    </div>
  )
}
