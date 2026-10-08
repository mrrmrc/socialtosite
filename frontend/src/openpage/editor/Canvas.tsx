import { useMemo } from 'react'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { CanvasEmpty } from './CanvasEmpty'
import { BlockWrapper } from '@/blocks/BlockWrapper'
import { RenderBlock } from '@/blocks/registry'
import { resolveTheme, themeToCSS } from '@/lib/theme-presets'
import { useGoogleFonts } from '@/lib/useGoogleFonts'
import { useProjectsStore } from '@/store/projectsStore'
import { previewPage } from '@/lib/preview-navigation'

export function Canvas() {
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const theme = useConfigStore((s) => s.config.theme)
  const { selectedBlockId, selectBlock, viewport, previewMode, activeProjectId } = useEditorStore()
  const pages = useConfigStore(s => s.config.pages) || []
  const setActivePage = useConfigStore(s => s.setActivePage)
  const liveUrl = useProjectsStore(s => s.projects.find(project => project.id === activeProjectId)?.deployUrl)

  const resolved = useMemo(() => resolveTheme(theme), [theme])
  const cssVars = useMemo(() => themeToCSS(resolved), [resolved])
  useGoogleFonts([resolved.fontSans, resolved.fontDisplay, resolved.fontMono])

  const maxWidth = viewport === 'desktop' ? '100%' : viewport === 'tablet' ? '768px' : '375px'

  if (blocks.length === 0) {
    return <CanvasEmpty />
  }

  const canvasContent = (
    <div
      className="site-render @container border rounded-xl min-h-[400px] relative z-[1] overflow-hidden transition-all duration-300"
      style={{ width: '100%', maxWidth, ...cssVars, color: 'var(--color-text-0)', backgroundColor: 'var(--color-bg-1)', borderColor: 'var(--color-border-default)' } as React.CSSProperties}
      onClick={(e) => {
        if (e.target === e.currentTarget) selectBlock(null)
      }}
      onClickCapture={e => {
        if (!previewMode || !(e.target instanceof Element)) return
        const anchor = e.target.closest('a')
        if (!anchor) return
        const href = anchor.getAttribute('href') || ''
        if (href.startsWith('#')) return
        const page = previewPage(href, pages, window.location.origin, liveUrl)
        if (page) {
          e.preventDefault()
          setActivePage(page.id)
          e.currentTarget.closest('.editor-canvas-scroll')?.scrollTo({ top: 0 })
        } else if (/^(https?:|\/)/.test(href)) {
          anchor.target = '_blank'
          anchor.rel = 'noopener noreferrer'
        }
      }}
      role="region"
      aria-label={`Site preview, ${blocks.length} blocks, ${viewport} viewport`}
    >
      {blocks.map((block) => (
        <BlockWrapper
          key={block.id}
          block={block}
          isSelected={selectedBlockId === block.id}
          onSelect={() => selectBlock(block.id)}
        >
          <RenderBlock block={block} />
        </BlockWrapper>
      ))}
    </div>
  )

  return (
    <div className="editor-canvas-scroll flex-1 min-h-0 flex items-start justify-center p-4 overflow-auto relative">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--color-bg-3) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {viewport === 'tablet' ? (
        <div className="relative z-[1]">
          {/* Tablet frame */}
          <div className="border-[12px] border-bg-4 rounded-2xl bg-bg-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="rounded-lg overflow-hidden">
              {canvasContent}
            </div>
          </div>
        </div>
      ) : viewport === 'mobile' ? (
        <div className="relative z-[1]">
          {/* Phone frame */}
          <div className="border-[10px] border-bg-4 rounded-[2rem] bg-bg-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            {/* Notch */}
            <div className="flex justify-center -mt-[4px] mb-1">
              <div className="w-24 h-5 bg-bg-4 rounded-b-xl" />
            </div>
            <div className="rounded-xl overflow-hidden">
              {canvasContent}
            </div>
            {/* Home indicator */}
            <div className="flex justify-center mt-2 pb-1">
              <div className="w-28 h-1 bg-bg-5 rounded-full" />
            </div>
          </div>
        </div>
      ) : (
        canvasContent
      )}
    </div>
  )
}
