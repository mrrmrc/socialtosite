import { t, getBrowserLanguage } from '@/lib/i18n'
import { useEffect, useRef } from 'react'
import { X, Clock, RotateCcw } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { useConfigStore } from '@/store/configStore'

function timeAgo(ts: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (seconds < 10) return t('Just now')
  const formatter = new Intl.RelativeTimeFormat(getBrowserLanguage(), { numeric: 'auto' })
  if (seconds < 60) return formatter.format(-seconds, 'second')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return formatter.format(-minutes, 'minute')
  return formatter.format(-Math.floor(minutes / 60), 'hour')
}

export function VersionHistory() {
  const { historyOpen, toggleHistory } = useEditorStore()
  const undoStack = useConfigStore((s) => s.undoStack)
  const panelRef = useRef<HTMLDivElement>(null)

  const entries = [...undoStack].reverse()

  // Close on Escape
  useEffect(() => {
    if (!historyOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); toggleHistory() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [historyOpen, toggleHistory])

  // Close on click outside
  useEffect(() => {
    if (!historyOpen) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        toggleHistory()
      }
    }
    // Delay to avoid catching the toggle button click itself
    const id = setTimeout(() => window.addEventListener('mousedown', handleClick), 0)
    return () => { clearTimeout(id); window.removeEventListener('mousedown', handleClick) }
  }, [historyOpen, toggleHistory])

  return (
    <div
      ref={panelRef}
      className={`absolute top-0 right-0 bottom-0 w-80 bg-bg-1 border-l border-border-default z-50 flex flex-col transition-transform duration-250 ease-in-out ${
        historyOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border-default flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-text-2" />
          <h3 className="text-sm font-semibold">{t("Version History")}</h3>
          <span className="text-[15px] text-text-3">({entries.length})</span>
        </div>
        <button
          onClick={toggleHistory}
          className="w-7 h-7 rounded flex items-center justify-center text-text-3 hover:text-text-0 hover:bg-bg-3 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Current state */}
        <div className="p-3 rounded-lg bg-green-glow mb-0.5">
          <div className="flex items-center gap-1.5 text-[15px] text-text-2 mb-1">
            <span>{t("Current")}</span>
            <span className="text-[15px] px-1.5 py-0.5 rounded-full font-semibold bg-green-glow text-green">
              {t("latest")}
            </span>
          </div>
          <div className="text-[15px] text-text-1">{t("Current state")}</div>
        </div>

        {entries.map((entry, i) => (
          <div
            key={i}
            onClick={() => {
              for (let n = 0; n <= i; n++) useConfigStore.getState().undo()
            }}
            className="p-3 rounded-lg cursor-pointer transition-colors mb-0.5 hover:bg-bg-3 group"
          >
            <div className="flex items-center gap-1.5 text-[15px] text-text-2 mb-1">
              <span>{timeAgo(entry.timestamp)}</span>
              <span className="text-[15px] px-1.5 py-0.5 rounded-full font-semibold bg-status-blue/10 text-status-blue">
                {t("manual")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[15px] text-text-1">{t(entry.label)}</div>
              <RotateCcw size={12} className="text-text-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <div className="p-4 text-center text-[15px] text-text-3">
            {t("No history yet. Make some changes to see history.")}
          </div>
        )}
      </div>
    </div>
  )
}
