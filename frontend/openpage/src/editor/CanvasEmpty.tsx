import { t } from '@/lib/i18n'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { blockMetadata } from '@/lib/block-metadata'
import type { BlockConfig } from '@/blocks/types'

export function CanvasEmpty() {
  const addBlock = useConfigStore((s) => s.addBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  function handleAddBlock() {
    const heroMeta = blockMetadata.find((b) => b.type === 'hero')!
    const block: BlockConfig = {
      id: `block-${Date.now()}`,
      type: heroMeta.type,
      variant: heroMeta.variants[0],
      props: { ...heroMeta.defaultProps },
    }
    addBlock(block)
    selectBlock(block.id)
    toast(t('Hero block added'))
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-10 relative z-[1]">
      <h3 className="text-lg font-semibold text-text-1">{t("Start building")}</h3>
      <p className="text-[15px] text-text-3 max-w-[360px] leading-relaxed">
        {t("Add your first component from the library, or use the Components page to browse all blocks.")}
      </p>
      <button
        onClick={handleAddBlock}
        className="px-3.5 py-1.5 rounded-md bg-green text-black text-[15px] font-semibold border border-green hover:bg-green-dim transition-colors flex items-center gap-1.5"
      >
        <Plus size={14} />
        {t("Add Hero Block")}
      </button>
    </div>
  )
}
